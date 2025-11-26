// src/main/javaScanner.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class JavaScanner {
  constructor() {
    this.detectedJavas = [];
  }

  // Escanear el sistema en busca de instalaciones de Java
  async scanForJava() {
    this.detectedJavas = [];

    // Detectar en JAVA_HOME
    await this.scanJavaHome();

    // Detectar en PATH
    await this.scanJavaInPath();

    // Detectar en ubicaciones comunes según el sistema operativo
    if (process.platform === 'win32') {
      await this.scanWindowsJava();
    } else if (process.platform === 'darwin') {
      await this.scanMacOSJava();
    } else if (process.platform === 'linux') {
      await this.scanLinuxJava();
    }

    return this.detectedJavas;
  }

  // Escanear JAVA_HOME
  async scanJavaHome() {
    if (process.env.JAVA_HOME) {
      const javaPath = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(javaPath)) {
        try {
          const version = this.getJavaVersionSync(javaPath);
          this.detectedJavas.push({
            id: `java_home_${version.replace(/\./g, '_')}`,
            path: javaPath,
            version: version,
            isWorking: true,
            source: 'JAVA_HOME'
          });
        } catch (error) {
          // Si no se puede ejecutar, pero existe el archivo
          this.detectedJavas.push({
            id: `java_home_unknown`,
            path: javaPath,
            version: 'unknown',
            isWorking: false,
            source: 'JAVA_HOME'
          });
        }
      }
    }
  }

  // Escanear en PATH
  async scanJavaInPath() {
    try {
      const whichCmd = process.platform === 'win32' ? 'where java' : 'which java';
      const result = execSync(whichCmd, { encoding: 'utf8' });
      const javaPath = result.trim().split('\n')[0]; // Tomar la primera coincidencia
      
      if (javaPath && fs.existsSync(javaPath.trim())) {
        const trimmedPath = javaPath.trim();
        try {
          const version = this.getJavaVersionSync(trimmedPath);
          this.detectedJavas.push({
            id: `path_${version.replace(/\./g, '_')}`,
            path: trimmedPath,
            version: version,
            isWorking: true,
            source: 'PATH'
          });
        } catch (error) {
          this.detectedJavas.push({
            id: `path_unknown`,
            path: trimmedPath,
            version: 'unknown',
            isWorking: false,
            source: 'PATH'
          });
        }
      }
    } catch (error) {
      // Java no está en PATH, ignorar
    }
  }

  // Escanear Java en Windows
  async scanWindowsJava() {
    const commonLocations = [
      'C:/Program Files/Java/',
      'C:/Program Files/Eclipse Adoptium/',
      'C:/Program Files/Amazon Corretto/',
      'C:/Program Files/Temurin/',
      'C:/Program Files/OpenJDK/',
      'C:/Program Files/Oracle/'
    ];

    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        const subdirs = fs.readdirSync(location, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        
        for (const subdir of subdirs) {
          const javaPath = path.join(location, subdir, 'bin', 'java.exe');
          if (fs.existsSync(javaPath)) {
            try {
              const version = this.getJavaVersionFromPath(subdir) || this.getJavaVersionSync(javaPath);
              this.detectedJavas.push({
                id: `win_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: true,
                source: 'global'
              });
            } catch (error) {
              // No se pudo ejecutar pero el archivo existe
              const version = this.getJavaVersionFromPath(subdir) || 'unknown';
              this.detectedJavas.push({
                id: `win_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: false,
                source: 'global'
              });
            }
          }
        }
      }
    }

    // Escanear C:/Program Files/Java/ específicamente como mencionaste
    const programFilesJava = 'C:/Program Files/Java/';
    if (fs.existsSync(programFilesJava)) {
      const subdirs = fs.readdirSync(programFilesJava, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const subdir of subdirs) {
        const javaPaths = [
          path.join(programFilesJava, subdir, 'bin', 'java.exe'),
          path.join(programFilesJava, subdir, 'jre', 'bin', 'java.exe')
        ];

        for (const javaPath of javaPaths) {
          if (fs.existsSync(javaPath)) {
            try {
              const version = this.getJavaVersionFromPath(subdir) || this.getJavaVersionSync(javaPath);
              this.detectedJavas.push({
                id: `pf_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: true,
                source: 'global'
              });
              break; // Solo agregar uno por directorio
            } catch (error) {
              const version = this.getJavaVersionFromPath(subdir) || 'unknown';
              this.detectedJavas.push({
                id: `pf_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: false,
                source: 'global'
              });
              break;
            }
          }
        }
      }
    }
  }

  // Escanear Java en Linux
  async scanLinuxJava() {
    const commonLocations = [
      '/usr/lib/jvm/',
      '/usr/java/',
      '/opt/java/',
      '/usr/lib64/jvm/',
      '/opt/'
    ];

    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        const subdirs = fs.readdirSync(location, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const subdir of subdirs) {
          const javaPath = path.join(location, subdir, 'bin', 'java');
          if (fs.existsSync(javaPath)) {
            try {
              const version = this.getJavaVersionFromPath(subdir) || this.getJavaVersionSync(javaPath);
              this.detectedJavas.push({
                id: `linux_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: true,
                source: 'global'
              });
            } catch (error) {
              const version = this.getJavaVersionFromPath(subdir) || 'unknown';
              this.detectedJavas.push({
                id: `linux_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: false,
                source: 'global'
              });
            }
          }
        }
      }
    }
  }

  // Escanear Java en macOS
  async scanMacOSJava() {
    const commonLocations = [
      '/Library/Java/JavaVirtualMachines/',
      '/System/Library/Java/JavaVirtualMachines/',
      '/Users/Shared/JDK/',
    ];

    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        const subdirs = fs.readdirSync(location, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const subdir of subdirs) {
          const javaPath = path.join(location, subdir, 'Contents', 'Home', 'bin', 'java');
          if (fs.existsSync(javaPath)) {
            try {
              const version = this.getJavaVersionFromPath(subdir) || this.getJavaVersionSync(javaPath);
              this.detectedJavas.push({
                id: `macos_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: true,
                source: 'global'
              });
            } catch (error) {
              const version = this.getJavaVersionFromPath(subdir) || 'unknown';
              this.detectedJavas.push({
                id: `macos_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version.replace(/\./g, '_')}`,
                path: javaPath,
                version: version,
                isWorking: false,
                source: 'global'
              });
            }
          }
        }
      }
    }
  }

  // Obtener versión de Java ejecutando el binario
  getJavaVersionSync(javaPath) {
    try {
      const result = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8' });
      const versionMatch = result.match(/version "([^"]+)"/);
      
      if (versionMatch && versionMatch[1]) {
        const fullVersion = versionMatch[1];
        // Convertir versiones como 1.8.0_XXX a 8
        if (fullVersion.startsWith('1.8')) return '8';
        if (fullVersion.startsWith('1.7')) return '7';
        if (fullVersion.startsWith('1.6')) return '6';
        if (fullVersion.startsWith('1.9')) return '9';
        
        // Para versiones modernas como 11, 17, 21
        const majorVersion = fullVersion.split('.')[0];
        return majorVersion;
      }
      
      return 'unknown';
    } catch (error) {
      throw error;
    }
  }

  // Inferir versión de Java desde el nombre de directorio
  getJavaVersionFromPath(dirName) {
    const patterns = [
      /jdk(\d+)/i,           // jdk8, jdk17
      /jdk-?(\d+)/i,         // jdk-8, jdk17, jdk-17
      /openjdk(\d+)/i,       // openjdk8, openjdk17
      /java(\d+)/i,          // java8, java17
      /(\d+)/,               // 8, 17, 21
      /(\d+)u/i,             // 8u472
    ];

    for (const pattern of patterns) {
      const match = dirName.match(pattern);
      if (match && match[1]) {
        const version = match[1];
        // Validar que sea una versión de Java real
        if (['8', '11', '17', '21', '25', '9', '10', '12', '13', '14', '15', '16', '18', '19', '20'].includes(version)) {
          return version;
        }
      }
    }
    
    return null;
  }
}

// Exportar instancia única
const javaScanner = new JavaScanner();
module.exports = { javaScanner };