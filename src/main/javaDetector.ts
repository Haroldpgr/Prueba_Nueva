// src/main/javaDetector.ts
import { execSync, spawn } from 'child_process';
import { join, dirname } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import os from 'os';

// No definir JavaInfo aquí, usar la importación desde types
import type { JavaInfo } from '../renderer/types/java.d';

export class JavaDetector {
  private detectedJavas: JavaInfo[] = [];
  private javaRegistryKeys: string[] = [];
  private defaultJavaId: string | null = null;
  private config: { defaultJavaId: string | null; installedJavas: JavaInfo[] } = { defaultJavaId: null, installedJavas: [] };

  constructor() {
    // No llamar a detectJava aquí para evitar ejecuciones no deseadas al instanciar
  }

  private saveConfig() {
    // Lógica para guardar la configuración (puede estar vacía si se maneja externamente)
    console.log('Guardando configuración de Java...');
  }

  async detectJava(): Promise<JavaInfo[]> {
    this.detectedJavas = [];
    
    // Detectar JAVA_HOME
    if (process.env.JAVA_HOME) {
      const javaHomePath = process.platform === 'win32'
        ? join(process.env.JAVA_HOME, 'bin', 'java.exe')
        : join(process.env.JAVA_HOME, 'bin', 'java');

      if (existsSync(javaHomePath)) {
        try {
          const version = await this.getJavaVersion(javaHomePath);
          this.detectedJavas.push({
            id: `java_home_${version.replace(/\./g, '_')}`,
            path: javaHomePath,
            version: version,
            isWorking: true,
            source: 'JAVA_HOME'
          });
        } catch (error) {
          console.error('Error testing JAVA_HOME Java:', error);
        }
      }
    }

    // Detectar en Windows (registros y ubicaciones comunes)
    if (process.platform === 'win32') {
      await this.detectJavaInWindows();
    }
    // Detectar en Linux
    else if (process.platform === 'linux') {
      await this.detectJavaInLinux();
    }
    // Detectar en macOS
    else if (process.platform === 'darwin') {
      await this.detectJavaInMacOS();
    }

    // Detectar en PATH
    await this.detectJavaInPath();

    // Eliminar duplicados
    this.detectedJavas = this.removeDuplicates(this.detectedJavas);

    return this.detectedJavas;
  }

  private async detectJavaInWindows(): Promise<void> {
    const commonPaths = [
      'C:/Program Files/Java/',
      'C:/Program Files/Eclipse Adoptium/',
      'C:/Program Files/Amazon Corretto/',
      'C:/Program Files/Temurin/',
      'C:/Program Files/OpenJDK/',
      'C:/Program Files/Oracle/',
      'C:/Program Files/RedHat/',
      'C:/Program Files/Microsoft/'
    ];

    for (const basePath of commonPaths) {
      if (existsSync(basePath)) {
        try {
          const folders = readdirSync(basePath);
          for (const folder of folders) {
            const fullPath = join(basePath, folder, 'bin', 'java.exe');
            if (existsSync(fullPath)) {
              try {
                const version = await this.getJavaVersion(fullPath);
                this.detectedJavas.push({
                  id: `win_${folder.replace(/\s+/g, '_')}_${version.replace(/\./g, '_')}`,
                  path: fullPath,
                  version: version,
                  isWorking: true,
                  source: 'global'
                });
              } catch (error) {
                // Si no se puede obtener la versión, intentar con un método alternativo
                try {
                  const version = await this.getJavaVersionFromDirName(folder);
                  this.detectedJavas.push({
                    id: `win_${folder.replace(/\s+|_/g, '_')}_${version.replace(/\./g, '_')}`,
                    path: fullPath,
                    version: version,
                    isWorking: true,
                    source: 'global'
                  });
                } catch {
                  // Si no podemos detectar la versión, aún podemos agregarlo con versión desconocida
                  this.detectedJavas.push({
                    id: `win_${folder.replace(/\s+|_/g, '_')}_unknown`,
                    path: fullPath,
                    version: 'unknown',
                    isWorking: true,
                    source: 'global'
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error scanning ${basePath}:`, error);
        }
      }
    }

    // Verificación adicional específica para C:/Program Files/Java
    const programFilesJavaPath = 'C:/Program Files/Java/';
    if (existsSync(programFilesJavaPath)) {
      try {
        const subfolders = readdirSync(programFilesJavaPath);
        for (const folder of subfolders) {
          // Buscar en subdirectorios que parecen versiones de Java
          const possibleJavaPaths = [
            join(programFilesJavaPath, folder, 'bin', 'java.exe'),
            join(programFilesJavaPath, folder, 'bin', 'javaw.exe'),
            join(programFilesJavaPath, folder, 'jre', 'bin', 'java.exe'),
          ];

          for (const javaPath of possibleJavaPaths) {
            if (existsSync(javaPath)) {
              try {
                const version = await this.getJavaVersion(javaPath);
                this.detectedJavas.push({
                  id: `pf_${folder.replace(/\s+/g, '_')}_${version.replace(/\./g, '_')}`,
                  path: javaPath,
                  version: version,
                  isWorking: true,
                  source: 'global'
                });
                break; // Solo agregar uno por carpeta
              } catch (error) {
                // Intentar obtener versión del nombre de directorio
                try {
                  const version = await this.getJavaVersionFromDirName(folder);
                  this.detectedJavas.push({
                    id: `pf_${folder.replace(/\s+|_/g, '_')}_${version.replace(/\./g, '_')}`,
                    path: javaPath,
                    version: version,
                    isWorking: true,
                    source: 'global'
                  });
                  break;
                } catch {
                  // Agregar con versión "unknown" si no se puede determinar
                  this.detectedJavas.push({
                    id: `pf_${folder.replace(/\s+|_/g, '_')}_unknown`,
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
      } catch (error) {
        console.error(`Error scanning ${programFilesJavaPath}:`, error);
      }
    }

    // Intentar leer desde el registro de Windows
    try {
      // Verificar JavaSoft registry entries
      const javaRuntimeRegPath = 'SOFTWARE\\JavaSoft\\Java Runtime Environment';
      const javaRuntimeRegResults = execSync(`reg query "${javaRuntimeRegPath}" /s`, { encoding: 'utf8' });

      // Buscar instalaciones registradas en el registro de Java
      const runtimeMatches = javaRuntimeRegResults.match(/HKEY_LOCAL_MACHINE\\[^\\]+\\JavaSoft\\Java Runtime Environment\\([0-9.]+)/g);
      if (runtimeMatches) {
        for (const match of runtimeMatches) {
          const version = match.split('\\').pop()?.trim();
          if (version) {
            try {
              const versionQuery = `reg query "${javaRuntimeRegPath}\\${version}" /v JavaHome`;
              const result = execSync(versionQuery, { encoding: 'utf8' });
              const homeMatch = result.match(/REG_SZ\s+(.+)/);
              if (homeMatch) {
                const javaHome = homeMatch[1].trim();
                const javaPath = join(javaHome, 'bin', 'java.exe');
                if (existsSync(javaPath)) {
                  const finalVersion = await this.getJavaVersion(javaPath);
                  this.detectedJavas.push({
                    id: `registry_jre_${finalVersion.replace(/\./g, '_')}`,
                    path: javaPath,
                    version: finalVersion,
                    isWorking: true,
                    source: 'registry'
                  });
                }
              }
            } catch (error) {
              console.error(`Error reading registry entry for Java ${version}:`, error);
            }
          }
        }
      }

      // Probar también con JDK registry entries
      const javaJdkRegPath = 'SOFTWARE\\JavaSoft\\Java Development Kit';
      const javaJdkRegResults = execSync(`reg query "${javaJdkRegPath}" /s`, { encoding: 'utf8' });

      const jdkMatches = javaJdkRegResults.match(/HKEY_LOCAL_MACHINE\\[^\\]+\\JavaSoft\\Java Development Kit\\([0-9.]+)/g);
      if (jdkMatches) {
        for (const match of jdkMatches) {
          const version = match.split('\\').pop()?.trim();
          if (version) {
            try {
              const versionQuery = `reg query "${javaJdkRegPath}\\${version}" /v JavaHome`;
              const result = execSync(versionQuery, { encoding: 'utf8' });
              const homeMatch = result.match(/REG_SZ\s+(.+)/);
              if (homeMatch) {
                const javaHome = homeMatch[1].trim();
                const javaPath = join(javaHome, 'bin', 'java.exe');
                if (existsSync(javaPath)) {
                  const finalVersion = await this.getJavaVersion(javaPath);
                  this.detectedJavas.push({
                    id: `registry_jdk_${finalVersion.replace(/\./g, '_')}`,
                    path: javaPath,
                    version: finalVersion,
                    isWorking: true,
                    source: 'registry'
                  });
                }
              }
            } catch (error) {
              console.error(`Error reading registry entry for JDK ${version}:`, error);
            }
          }
        }
      }
    } catch (error) {
      // No hay entradas de Java en el registro o no se puede acceder
      console.info('Registry query failed - this may be normal on some systems');
    }
  }

  // Método auxiliar para inferir la versión desde el nombre del directorio
  private async getJavaVersionFromDirName(dirName: string): Promise<string> {
    // Intentar detectar la versión del nombre del directorio
    const patterns = [
      /jdk(\d+)/i,           // jdk8, jdk17, jdk21
      /jdk-(\d+)/i,          // jdk-8, jdk-17, jdk-21
      /openjdk(\d+)/i,       // openjdk8, openjdk17
      /java(\d+)/i,          // java8, java17
      /(\d+)/,               // 8, 17, 21
    ];

    for (const pattern of patterns) {
      const match = dirName.match(pattern);
      if (match && match[1]) {
        const version = match[1];
        // Asegurarse de que sea una versión válida de Java
        if (['8', '11', '17', '21', '25'].includes(version)) {
          return version;
        }
      }
    }

    return 'unknown';
  }


  private async detectJavaInLinux(): Promise<void> {
    const commonPaths = [
      '/usr/lib/jvm/',
      '/usr/java/',
      '/opt/java/',
      '/usr/lib64/jvm/',
    ];

    for (const basePath of commonPaths) {
      if (existsSync(basePath)) {
        try {
          const folders = readdirSync(basePath);
          for (const folder of folders) {
            const fullPath = join(basePath, folder, 'bin', 'java');
            if (existsSync(fullPath)) {
              const version = await this.getJavaVersion(fullPath);
              this.detectedJavas.push({
                id: `linux_${folder.replace(/\s+/g, '_')}_${version.replace(/\./g, '_')}`,
                path: fullPath,
                version: version,
                isWorking: true,
                source: 'global'
              });
            }
          }
        } catch (error) {
          console.error(`Error scanning ${basePath}:`, error);
        }
      }
    }
  }

  private async detectJavaInMacOS(): Promise<void> {
    const commonPaths = [
      '/Library/Java/JavaVirtualMachines/',
      '/System/Library/Java/JavaVirtualMachines/',
      '/Users/' + os.userInfo().username + '/.sdkman/candidates/java/current/',
    ];

    for (const basePath of commonPaths) {
      if (existsSync(basePath)) {
        try {
          const folders = readdirSync(basePath);
          for (const folder of folders) {
            const fullPath = join(basePath, folder, 'Contents', 'Home', 'bin', 'java');
            if (existsSync(fullPath)) {
              const version = await this.getJavaVersion(fullPath);
              this.detectedJavas.push({
                id: `mac_${folder.replace(/\s+/g, '_')}_${version.replace(/\./g, '_')}`,
                path: fullPath,
                version: version,
                isWorking: true,
                source: 'global'
              });
            }
          }
        } catch (error) {
          console.error(`Error scanning ${basePath}:`, error);
        }
      }
    }
  }

  private async detectJavaInPath(): Promise<void> {
    try {
      // Buscar java en PATH
      const javaPath = this.which('java');
      if (javaPath) {
        const version = await this.getJavaVersion(javaPath);
        this.detectedJavas.push({
          id: `path_${version.replace(/\./g, '_')}`,
          path: javaPath,
          version: version,
          isWorking: true,
          source: 'PATH'
        });
      }
    } catch (error) {
      // java no está disponible en PATH
    }

    // Buscar javaw en Windows
    if (process.platform === 'win32') {
      try {
        const javawPath = this.which('javaw');
        if (javawPath) {
          const version = await this.getJavaVersion(javawPath);
          this.detectedJavas.push({
            id: `javaw_${version.replace(/\./g, '_')}`,
            path: javawPath,
            version: version,
            isWorking: true,
            source: 'PATH'
          });
        }
      } catch (error) {
        // javaw no está disponible en PATH
      }
    }
  }

  private which(command: string): string | null {
    try {
      if (process.platform === 'win32') {
        const result = execSync(`where ${command}`, { encoding: 'utf8' });
        return result.trim().split('\n')[0].trim();
      } else {
        const result = execSync(`which ${command}`, { encoding: 'utf8' });
        return result.trim();
      }
    } catch (error) {
      return null;
    }
  }

  public getJavaVersion(javaPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(javaPath, ['-version']);

      let output = '';
      let errorOutput = '';

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 || errorOutput) {
          // La versión generalmente se imprime en stderr para java -version
          const versionMatch = errorOutput.match(/version\s+"([^"]+)"/i);
          if (versionMatch && versionMatch[1]) {
            resolve(this.normalizeVersion(versionMatch[1]));
          } else {
            resolve('unknown');
          }
        } else {
          reject(new Error(`Failed to get Java version: ${errorOutput}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private normalizeVersion(version: string): string {
    // Convertir versiones como "1.8.0_XXX" a "8"
    if (version.startsWith('1.8')) return '8';
    if (version.startsWith('1.7')) return '7';
    if (version.startsWith('1.6')) return '6';
    // Para versiones modernas como 11, 17, 21, etc.
    const majorMatch = version.match(/^(\d+)/);
    if (majorMatch) {
      return majorMatch[1];
    }
    return version;
  }

  private removeDuplicates(javas: JavaInfo[]): JavaInfo[] {
    const seenPaths = new Set<string>();
    return javas.filter(java => {
      if (seenPaths.has(java.path.toLowerCase())) {
        return false;
      }
      seenPaths.add(java.path.toLowerCase());
      return true;
    });
  }

  getDetectedJavas(): JavaInfo[] {
    return this.detectedJavas;
  }
}

// Instancia global
export const javaDetector = new JavaDetector();