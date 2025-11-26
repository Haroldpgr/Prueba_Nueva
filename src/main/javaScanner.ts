// src/main/javaScanner.ts
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface JavaInstallation {
  id: string;
  path: string;
  version: string;
  isWorking: boolean;
  source: 'global' | 'installed' | 'JAVA_HOME' | 'PATH' | 'registry';
}

export class JavaScanner {
  private detectedJavas: JavaInstallation[] = [];

  async scanForJava(): Promise<JavaInstallation[]> {
    this.detectedJavas = [];

    // 1. Detectar desde JAVA_HOME
    await this.scanJavaHome();

    // 2. Detectar en PATH
    await this.scanJavaInPath();

    // 3. Detectar en ubicaciones comunes en Windows
    if (process.platform === 'win32') {
      await this.scanWindowsLocations();
    } 
    // 4. Detectar en ubicaciones comunes en Linux
    else if (process.platform === 'linux') {
      await this.scanLinuxLocations();
    }
    // 5. Detectar en ubicaciones comunes en macOS
    else if (process.platform === 'darwin') {
      await this.scanMacOSLocations();
    }

    // 6. Detectar en directorios dentro de Program Files
    if (process.platform === 'win32') {
      await this.scanJavaInProgramFiles();
    }

    return this.detectedJavas;
  }

  private async scanJavaHome(): Promise<void> {
    if (process.env.JAVA_HOME) {
      const javaExecutable = process.platform === 'win32' 
        ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe')
        : path.join(process.env.JAVA_HOME, 'bin', 'java');
      
      if (fs.existsSync(javaExecutable)) {
        try {
          const version = await this.getJavaVersion(javaExecutable);
          this.detectedJavas.push({
            id: `java_home_${version.replace(/\./g, '_')}`,
            path: javaExecutable,
            version,
            isWorking: true,
            source: 'JAVA_HOME'
          });
        } catch (error) {
          console.error('Error testing JAVA_HOME Java:', error);
        }
      }
    }
  }

  private async scanJavaInPath(): Promise<void> {
    try {
      const { stdout } = await execAsync('where java 2>nul || which java 2>/dev/null');
      const javaPath = stdout.trim();
      
      if (javaPath) {
        try {
          const version = await this.getJavaVersion(javaPath);
          this.detectedJavas.push({
            id: `path_${version.replace(/\./g, '_')}`,
            path: javaPath,
            version,
            isWorking: true,
            source: 'PATH'
          });
        } catch (error) {
          console.error('Error testing PATH Java:', error);
        }
      }
    } catch (error) {
      // java no está en PATH
    }
  }

  private async scanWindowsLocations(): Promise<void> {
    const commonLocations = [
      'C:/Program Files/Java/',
      'C:/Program Files/Eclipse Adoptium/',
      'C:/Program Files/Amazon Corretto/',
      'C:/Program Files/Temurin/',
      'C:/Program Files/OpenJDK/',
      'C:/Program Files/Oracle/',
      'C:/Program Files/BellSoft/',
      'C:/Program Files/Zulu/',
      'C:/Program Files/Microsoft/Java/'
    ];

    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        const subdirs = fs.readdirSync(location).filter(item => 
          fs.statSync(path.join(location, item)).isDirectory()
        );
        
        for (const subdir of subdirs) {
          const javaPath = path.join(location, subdir, 'bin', 'java.exe');
          if (fs.existsSync(javaPath)) {
            try {
              const version = await this.tryGetVersionFromPath(subdir) || await this.getJavaVersion(javaPath);
              this.detectedJavas.push({
                id: `win_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version,
                isWorking: true,
                source: 'global'
              });
            } catch (error) {
              // No se pudo obtener la versión, pero el binario existe
              const version = await this.tryGetVersionFromPath(subdir) || 'unknown';
              this.detectedJavas.push({
                id: `win_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version,
                isWorking: true,
                source: 'global'
              });
            }
          }
        }
      }
    }
  }

  private async scanJavaInProgramFiles(): Promise<void> {
    const programFilesJava = 'C:/Program Files/Java/';
    if (fs.existsSync(programFilesJava)) {
      const subdirs = fs.readdirSync(programFilesJava).filter(item => 
        fs.statSync(path.join(programFilesJava, item)).isDirectory()
      );
      
      for (const subdir of subdirs) {
        const possiblePaths = [
          path.join(programFilesJava, subdir, 'bin', 'java.exe'),
          path.join(programFilesJava, subdir, 'bin', 'javaw.exe'),
          path.join(programFilesJava, subdir, 'jre', 'bin', 'java.exe'),
          path.join(programFilesJava, subdir, 'jre', 'bin', 'javaw.exe')
        ];
        
        for (const javaPath of possiblePaths) {
          if (fs.existsSync(javaPath)) {
            try {
              const version = await this.getVersionFromDirectoryName(subdir);
              this.detectedJavas.push({
                id: `pf_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version,
                isWorking: true,
                source: 'global'
              });
              break; // Solo agregar uno por directorio
            } catch (error) {
              // Si no podemos obtener la versión del directorio, intentar ejecutando Java
              try {
                const version = await this.getJavaVersion(javaPath);
                this.detectedJavas.push({
                  id: `pf_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                  path: javaPath,
                  version,
                  isWorking: true,
                  source: 'global'
                });
                break;
              } catch {
                // Si tampoco podemos ejecutarlo, agregarlo como desconocido
                this.detectedJavas.push({
                  id: `pf_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_unknown`,
                  path: javaPath,
                  version: 'unknown',
                  isWorking: true,
                  source: 'global'
                });
                break;
              }
            }
          }
        }
      }
    }
  }

  private async scanLinuxLocations(): Promise<void> {
    const commonLocations = [
      '/usr/lib/jvm/',
      '/usr/java/',
      '/opt/java/',
      '/usr/lib64/jvm/',
      '/usr/local/openjdk/'
    ];

    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        const subdirs = fs.readdirSync(location).filter(item => 
          fs.statSync(path.join(location, item)).isDirectory()
        );
        
        for (const subdir of subdirs) {
          const javaPath = path.join(location, subdir, 'bin', 'java');
          if (fs.existsSync(javaPath)) {
            try {
              const version = await this.tryGetVersionFromPath(subdir) || await this.getJavaVersion(javaPath);
              this.detectedJavas.push({
                id: `linux_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version,
                isWorking: true,
                source: 'global'
              });
            } catch (error) {
              // Si no se pudo probar, pero el archivo existe
              const version = await this.tryGetVersionFromPath(subdir) || 'unknown';
              this.detectedJavas.push({
                id: `linux_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version,
                isWorking: true,
                source: 'global'
              });
            }
          }
        }
      }
    }
  }

  private async scanMacOSLocations(): Promise<void> {
    const commonLocations = [
      '/Library/Java/JavaVirtualMachines/',
      '/System/Library/Java/JavaVirtualMachines/',
      '/Applications/Xcode.app/Contents/Applications/Application Loader.app/Contents/itms/java/',
      '/usr/local/opt/',
      '/opt/homebrew/opt/'
    ];

    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        const subdirs = fs.readdirSync(location).filter(item => 
          fs.statSync(path.join(location, item)).isDirectory()
        );
        
        for (const subdir of subdirs) {
          const javaDir = path.join(location, subdir, 'Contents', 'Home');
          if (fs.existsSync(javaDir)) {
            const javaPath = path.join(javaDir, 'bin', 'java');
            if (fs.existsSync(javaPath)) {
              try {
                const version = await this.tryGetVersionFromPath(subdir) || await this.getJavaVersion(javaPath);
                this.detectedJavas.push({
                  id: `macos_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                  path: javaPath,
                  version,
                  isWorking: true,
                  source: 'global'
                });
              } catch (error) {
                // Si no se pudo ejecutar, pero existe el binario
                const version = await this.tryGetVersionFromPath(subdir) || 'unknown';
                this.detectedJavas.push({
                  id: `macos_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                  path: javaPath,
                  version,
                  isWorking: true,
                  source: 'global'
                });
              }
            }
          }
        }
      }
    }
  }

  private async getJavaVersion(javaPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(javaPath, ['-version']);
      let output = '';
      let errorOutput = '';

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 || errorOutput) {
          // Java -version imprime la versión en stderr
          const versionMatch = errorOutput.match(/version\s+"([^"]+)"/i);
          if (versionMatch && versionMatch[1]) {
            const fullVersion = versionMatch[1];
            // Extraer solo el número principal (8, 17, 21)
            if (fullVersion.startsWith('1.8')) return resolve('8');
            if (fullVersion.startsWith('1.7')) return resolve('7');
            if (fullVersion.startsWith('1.6')) return resolve('6');
            const majorMatch = fullVersion.match(/^(\d+)/);
            if (majorMatch) {
              return resolve(majorMatch[1]);
            }
            return resolve(fullVersion);
          }
          resolve('unknown');
        } else {
          reject(new Error(`Failed to get Java version: ${errorOutput}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async tryGetVersionFromPath(path: string): Promise<string> {
    // Buscar patrones comunes de nombre de directorio que indiquen la versión
    const patterns = [
      /jdk(\d+)/i,           // jdk8, jdk17, jdk21
      /jdk-(\d+)/i,          // jdk-8, jdk-17, jdk-21
      /openjdk(\d+)/i,       // openjdk8, openjdk17
      /java(\d+)/i,          // java8, java17
      /(\d+)/,               // 8, 17, 21
      /version(\d+)/i        // version8, version17
    ];

    for (const pattern of patterns) {
      const match = path.match(pattern);
      if (match && match[1]) {
        const version = match[1];
        // Verificar si es una versión de Java válida
        if (['8', '11', '17', '21', '25'].includes(version)) {
          return version;
        }
      }
    }

    return 'unknown';
  }

  private async getVersionFromDirectoryName(dirname: string): Promise<string> {
    // Intentar obtener la versión del nombre del directorio
    const versionPattern = /(?:jdk|java|openjdk|corretto)-?(\d+)(?:u\d+)?/i;
    const match = dirname.match(versionPattern);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // Si no se encuentra con el patrón principal, probar con otros patrones
    const patterns = [
      /(\d+)\.(\d+)\.(\d+)/,  // 17.0.1
      /(\d+)[._](\d+)/,        // 17_0_1, 8_472
      /(\d+)/                   // Solo número: 8, 17, 21
    ];
    
    for (const pattern of patterns) {
      const match = dirname.match(pattern);
      if (match && match[1]) {
        const version = match[1];
        // Verificar que sea una versión de Java válida
        if (['8', '11', '17', '21', '25', '1.8', '1.7', '1.6', '1.9'].includes(version)) {
          if (version === '1.8') return '8';
          if (version === '1.7') return '7';
          if (version === '1.6') return '6';
          if (version === '1.9') return '9';
          return version;
        }
      }
    }
    
    return 'unknown';
  }
}

export const javaScanner = new JavaScanner();