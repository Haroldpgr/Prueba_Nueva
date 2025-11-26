// src/main/javaDownloader.js
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class JavaDownloader {
  constructor() {
    this.runtimePath = path.join(os.homedir(), '.drk_launcher', 'runtime');
    if (!fs.existsSync(this.runtimePath)) {
      fs.mkdirSync(this.runtimePath, { recursive: true });
    }
  }

  // Obtener la URL de descarga de la API de Eclipse Adoptium
  async getJavaDownloadUrl(version) {
    // Determinar la plataforma
    const platform = process.platform;
    const arch = process.arch === 'x64' || process.arch === 'amd64' ? 'x64' : process.arch;
    
    let osFamily;
    switch (platform) {
      case 'win32':
        osFamily = 'windows';
        break;
      case 'darwin':
        osFamily = 'mac';
        break;
      case 'linux':
        osFamily = 'linux';
        break;
      default:
        osFamily = 'linux';
    }
    
    // Construir URL de la API de Adoptium
    const apiPath = `/v3/binary/latest/${version}/ga/jdk/${osFamily}/${arch}/jre/hotspot/normal/eclipse`;
    const url = `https://api.adoptium.net${apiPath}`;
    
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      client.get(url, {
        headers: {
          'User-Agent': 'DRK-Launcher/1.0',
          'Accept': 'application/json'
        }
      }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Si hay redirección, obtener la URL de destino
          const redirectUrl = response.headers.location;
          resolve(redirectUrl);
        } else {
          // Si no hay redirección, devolver la API URL que redirigirá el navegador
          resolve(url);
        }
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  // Descargar Java con progreso
  async downloadJava(version, onProgress) {
    try {
      // Obtener la URL de descarga
      const downloadUrl = await this.getJavaDownloadUrl(version);
      
      // Crear directorio de destino
      const targetDir = path.join(this.runtimePath, `java${version}`);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Nombre del archivo basado en la plataforma
      const platform = process.platform;
      const extension = platform === 'win32' ? '.msi' : platform === 'darwin' ? '.pkg' : '.tar.gz';
      const filename = `OpenJDK${version}U-jdk_${process.arch}_${platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux'}_hotspot_${Date.now()}.${extension}`;
      const filePath = path.join(targetDir, filename);
      
      // Comenzar la descarga
      return new Promise((resolve, reject) => {
        const client = downloadUrl.startsWith('https') ? https : http;
        
        client.get(downloadUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: ${response.statusCode} - ${response.statusMessage}`));
            return;
          }

          const totalLength = parseInt(response.headers['content-length'], 10) || 0;
          let downloadedLength = 0;
          
          const writeStream = fs.createWriteStream(filePath);
          
          response.on('data', (chunk) => {
            downloadedLength += chunk.length;
            
            if (onProgress && totalLength) {
              const progress = {
                received: downloadedLength,
                total: totalLength,
                percentage: Math.round((downloadedLength / totalLength) * 100)
              };
              onProgress(progress);
            }
          });
          
          response.pipe(writeStream);
          
          writeStream.on('finish', () => {
            console.log(`Java ${version} downloaded to: ${filePath}`);
            // Para versiones reales, aquí se debería instalar o extraer el archivo
            // Por ahora, devolver la ruta al archivo descargado
            resolve(filePath);
          });
          
          writeStream.on('error', (error) => {
            reject(error);
          });
        }).on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error(`Error downloading Java ${version}:`, error);
      throw error;
    }
  }

  // Instalar Java descargado (simulación para demostración)
  async installJava(version, downloadPath) {
    // En una implementación real, aquí se ejecutaría el instalador correspondiente
    // o se extraería el archivo .tar.gz/.zip
    
    // Simular instalación para demostración
    return new Promise((resolve) => {
      setTimeout(() => {
        // Encontrar la ruta del binario java después de la instalación
        const installDir = path.dirname(downloadPath).replace('runtime', path.join('runtime', `java${version}`));
        const javaBinary = path.join(installDir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
        
        // En una implementación real, se extraería/eliminiría el archivo descargado y se devolvería la ruta del binario
        resolve(javaBinary);
      }, 2000); // Simular proceso de instalación
    });
  }
}

// Exportar instancia única
const javaDownloader = new JavaDownloader();
module.exports = { javaDownloader };