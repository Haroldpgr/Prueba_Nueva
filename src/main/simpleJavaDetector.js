// src/main/simpleJavaDetector.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SimpleJavaDetector {
  constructor() {
    this.javaBaseDir = 'C:/Program Files/Java/';
  }

  // Detectar solo en C:\Program Files\Java\
  async detectJavaInProgramFiles() {
    const results = [];

    if (!fs.existsSync(this.javaBaseDir)) {
      return results; // Directorio no existe, retornar array vacío
    }

    const subdirs = fs.readdirSync(this.javaBaseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const subdir of subdirs) {
      // Buscar posibles rutas de java.exe
      const possiblePaths = [
        path.join(this.javaBaseDir, subdir, 'bin', 'java.exe'),
        path.join(this.javaBaseDir, subdir, 'bin', 'java'),
        path.join(this.javaBaseDir, subdir, 'jre', 'bin', 'java.exe'),
        path.join(this.javaBaseDir, subdir, 'jre', 'bin', 'java')
      ];

      for (const javaPath of possiblePaths) {
        if (fs.existsSync(javaPath)) {
          try {
            const version = this.getJavaVersion(javaPath);
            results.push({
              id: `pf_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${version}`,
              path: javaPath,
              version: version,
              isWorking: true,
              source: 'program_files'
            });
            break; // Solo agregar uno por directorio
          } catch (error) {
            // Si no se puede obtener la versión, agregarlo con marca de error
            const versionFromDir = this.extractVersionFromDir(subdir);
            results.push({
              id: `pf_${subdir.replace(/[^a-zA-Z0-9]/g, '_')}_${versionFromDir || 'unknown'}`,
              path: javaPath,
              version: versionFromDir || 'unknown',
              isWorking: false,
              source: 'program_files'
            });
            break; // Solo agregar uno por directorio
          }
        }
      }
    }

    return results;
  }

  // Extraer versión desde el nombre del directorio
  extractVersionFromDir(dirName) {
    // Patrones comunes para identificar versiones de Java
    const patterns = [
      /jdk(\d+)/i,           // jdk8, jdk17, jdk21
      /jdk-?(\d+)/i,         // jdk-8, jdk17, jdk-21
      /openjdk(\d+)/i,       // openjdk8, openjdk17
      /java(\d+)/i,          // java8, java17
      /(\d+)/                // Solo número: 8, 17, 21
    ];

    for (const pattern of patterns) {
      const match = dirName.match(pattern);
      if (match && match[1]) {
        const version = match[1];
        // Verificar que sea una versión de Java válida
        if (['8', '11', '17', '21', '25'].includes(version)) {
          return version;
        }
      }
    }

    return null;
  }

  // Obtener versión de Java ejecutando el binario
  getJavaVersion(javaPath) {
    try {
      const result = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8' });
      const versionMatch = result.match(/version "([^"]+)"/);
      
      if (versionMatch && versionMatch[1]) {
        const fullVersion = versionMatch[1];
        // Convertir versiones como 1.8.0_XXX a 8
        if (fullVersion.startsWith('1.8') || fullVersion.startsWith('1.8.0')) return '8';
        if (fullVersion.startsWith('1.7')) return '7';
        if (fullVersion.startsWith('1.6')) return '6';
        if (fullVersion.startsWith('1.9')) return '9';
        
        // Para versiones modernas como 17, 21
        const majorVersion = fullVersion.split('.')[0];
        return majorVersion;
      }
      
      return 'unknown';
    } catch (error) {
      throw error;
    }
  }

  // Detectar Java en otras ubicaciones (opcional)
  async detectOtherJavaLocations() {
    const results = [];
    
    // Detectar JAVA_HOME
    if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
      const javaPath = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
      if (fs.existsSync(javaPath)) {
        try {
          const version = this.getJavaVersion(javaPath);
          results.push({
            id: `java_home_${version}`,
            path: javaPath,
            version: version,
            isWorking: true,
            source: 'JAVA_HOME'
          });
        } catch (error) {
          results.push({
            id: `java_home_unknown`,
            path: javaPath,
            version: 'unknown',
            isWorking: false,
            source: 'JAVA_HOME'
          });
        }
      }
    }

    return results;
  }

  // Detectar todas las instalaciones de Java (solo en Program Files/Java por ahora)
  async detectAllJava() {
    const programFilesJava = await this.detectJavaInProgramFiles();
    const otherJava = await this.detectOtherJavaLocations();
    
    // Combinar y eliminar duplicados
    const allJava = [...programFilesJava, ...otherJava];
    const uniqueJava = allJava.filter((java, index, self) =>
      index === self.findIndex(j => j.path.toLowerCase() === java.path.toLowerCase())
    );
    
    return uniqueJava;
  }
}

// Exportar instancia única
const simpleJavaDetector = new SimpleJavaDetector();
module.exports = { simpleJavaDetector };