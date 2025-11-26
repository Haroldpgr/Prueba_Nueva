// src/main/javaService.js - Servicio de Java usando detector simplificado
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Importar el detector simplificado de Java
const { simpleJavaDetector } = require('./simpleJavaDetector');

class JavaService {
  constructor(runtimePath = './runtime') {
    this.runtimePath = runtimePath;
    this.defaultJavaId = null;
    this.installedJavas = this.loadConfig().installedJavas || [];
  }

  // Cargar configuración de Java
  loadConfig() {
    const configPath = path.join(this.runtimePath, 'java.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return {
      installedJavas: [],
      defaultJavaId: null
    };
  }

  // Guardar configuración de Java
  saveConfig() {
    const configPath = path.join(this.runtimePath, 'java.json');
    if (!fs.existsSync(this.runtimePath)) {
      fs.mkdirSync(this.runtimePath, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({
      installedJavas: this.installedJavas,
      defaultJavaId: this.defaultJavaId
    }, null, 2));
  }

  // Detección de Java instalado en C:\Program Files\Java\
  async detectGlobalJava() {
    try {
      // Usar el detector simplificado para encontrar Java en C:\Program Files\Java\
      const detectedJavas = await simpleJavaDetector.detectJavaInProgramFiles();
      
      // Combinar con Javas instalados por el launcher
      const allJavas = [...detectedJavas, ...this.installedJavas];
      
      // Eliminar duplicados basados en la ruta
      const uniqueJavas = allJavas.filter((java, index, self) =>
        index === self.findIndex(j => j.path.toLowerCase() === java.path.toLowerCase())
      );
      
      return uniqueJavas;
    } catch (error) {
      console.error('Error detecting Java:', error);
      return []; // Devolver array vacío en caso de error
    }
  }

  // Testear un binario de Java específico
  testJavaBinary(javaPath) {
    try {
      // Ejecutar java -version para verificar que el binario funciona
      const result = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8' });
      const versionMatch = result.match(/version "([^"]+)"/);

      if (versionMatch && versionMatch[1]) {
        const version = versionMatch[1];
        // Convertir versiones como 1.8.0_XXX a 8
        if (version.startsWith('1.8')) return { isWorking: true, version: '8' };
        if (version.startsWith('1.7')) return { isWorking: true, version: '7' };
        if (version.startsWith('1.6')) return { isWorking: true, version: '6' };
        
        // Para versiones modernas como 17, 21
        const majorVersion = version.split('.')[0];
        return { isWorking: true, version: majorVersion };
      }

      return { isWorking: true, version: 'unknown' };
    } catch (error) {
      console.error(`Error testing Java binary ${javaPath}:`, error);
      return {
        isWorking: false,
        error: error.message
      };
    }
  }

  // Explorar un binario de Java
  async exploreJava() {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { 
          name: 'Java Executable', 
          extensions: [process.platform === 'win32' ? 'exe' : ''] 
        },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Seleccionar archivo ejecutable de Java'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }

  // Instalar Java recomendado
  async installRecommendedJava(version, onProgress) {
    try {
      // Usar el downloader si está disponible, sino usar el detector simple
      if (this.javaDownloader) {
        const javaPath = await this.javaDownloader.downloadJava(version, onProgress);
        
        // Registrar la instalación
        const javaInfo = {
          id: `installed_java_${version}_${Date.now()}`,
          path: javaPath,
          version: version,
          isWorking: true,
          source: 'installed'
        };

        this.installedJavas.push(javaInfo);
        this.saveConfig();

        return {
          success: true,
          javaInfo,
          message: `Java ${version} installed successfully at: ${javaPath}`
        };
      } else {
        // Usar el detector para instalación
        const result = await simpleJavaDetector.installJava(version);
        return result;
      }
    } catch (error) {
      console.error(`Error installing Java ${version}:`, error);
      return {
        success: false,
        message: `Error installing Java ${version}: ${error.message}`
      };
    }
  }

  // Obtener todos los Javas instalados
  async getAllJavas() {
    try {
      return await this.detectGlobalJava();
    } catch (error) {
      console.error('Error getting all Javas:', error);
      return [];
    }
  }

  // Obtener Java predeterminado
  async getDefaultJava() {
    try {
      const allJava = await this.detectGlobalJava();
      // Obtener el ID del Java predeterminado
      return allJava.find(java => java.id === this.defaultJavaId) || allJava[0] || null;
    } catch (error) {
      console.error('Error getting default Java:', error);
      return null;
    }
  }

  // Establecer Java predeterminado
  setDefaultJava(javaId) {
    try {
      const allJava = this.installedJavas.concat(
        simpleJavaDetector.detectJavaInProgramFilesSync ? simpleJavaDetector.detectJavaInProgramFilesSync() : []
      );
      const exists = allJava.some(java => java.id === javaId);
      
      if (exists) {
        this.defaultJavaId = javaId;
        this.saveConfig();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error setting default Java:', error);
      return false;
    }
  }

  // Eliminar un Java instalado
  removeInstalledJava(javaId) {
    try {
      const originalLength = this.installedJavas.length;
      this.installedJavas = this.installedJavas.filter(j => j.id !== javaId);

      // Si se eliminó el Java predeterminado, limpiarlo
      if (this.defaultJavaId === javaId) {
        this.defaultJavaId = null;
      }

      this.saveConfig();
      return originalLength > this.installedJavas.length;
    } catch (error) {
      console.error('Error removing Java:', error);
      return false;
    }
  }

  // Obtener compatibilidad con Minecraft
  getMinecraftJavaCompatibility(minecraftVersion) {
    // Lógica de compatibilidad basada en la versión de Minecraft
    const versionNum = parseInt(minecraftVersion.replace(/^\D+/g, ''));
    
    if (versionNum < 17) {
      // Versiones anteriores a 1.17 requieren Java 8
      return {
        requiredVersion: '8',
        recommendedVersion: '8',
        note: 'Minecraft 1.16.5 y anteriores requieren Java 8'
      };
    } else if (versionNum < 21) {
      // Versiones 1.17-1.20.x requieren Java 17
      return {
        requiredVersion: '17',
        recommendedVersion: '17',
        note: 'Minecraft 1.17+ requieren Java 17 o superior'
      };
    } else {
      // Versiones 1.21+ pueden usar Java 21
      return {
        requiredVersion: '21',
        recommendedVersion: '21',
        note: 'Minecraft 1.21+ recomienda Java 21'
      };
    }
  }
}

// Exportar instancia única
const javaService = new JavaService();
module.exports = javaService;