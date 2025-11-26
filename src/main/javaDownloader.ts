// src/main/javaDownloader.ts
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import os from 'os';

const pipelineAsync = promisify(pipeline);

export interface JavaDownloadProgress {
  received: number;
  total: number;
  percentage: number;
}

export class JavaDownloader {
  private downloadProgressCallbacks: Map<string, (progress: JavaDownloadProgress) => void> = new Map();

  /**
   * Inicia la descarga de una versión específica de Java
   */
  async downloadJava(version: string, onProgress?: (progress: JavaDownloadProgress) => void): Promise<string> {
    // Generar un ID único para esta descarga
    const downloadId = `java_download_${version}_${Date.now()}`;
    
    if (onProgress) {
      this.downloadProgressCallbacks.set(downloadId, onProgress);
    }
    
    try {
      // Obtener la URL de descarga basada en la plataforma
      const downloadUrl = await this.getJavaDownloadUrlByVersion(version);
      
      // Directorio de destino
      const destinationDir = path.join(os.homedir(), '.drk_launcher', 'runtime', `java${version}`);
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }
      
      const filename = path.basename(downloadUrl);
      const filePath = path.join(destinationDir, filename);
      
      // Iniciar la descarga
      await this.downloadFile(downloadUrl, filePath, (progress) => {
        if (onProgress) {
          onProgress(progress);
        }
        // Llamar a cualquier callback registrado
        this.downloadProgressCallbacks.forEach(cb => cb(progress));
      });
      
      // Extraer el archivo descargado según el formato
      await this.extractJavaArchive(filePath, destinationDir);
      
      // Eliminar el archivo comprimido después de la extracción
      fs.unlinkSync(filePath);
      
      // Devolver la ruta al binario java recién instalado
      const javaBinaryPath = this.findJavaBinary(destinationDir);
      if (!javaBinaryPath) {
        throw new Error('No se pudo encontrar el binario java después de la instalación');
      }
      
      return javaBinaryPath;
    } catch (error) {
      console.error(`Error downloading Java ${version}:`, error);
      throw error;
    } finally {
      this.downloadProgressCallbacks.delete(downloadId);
    }
  }

  private async getJavaDownloadUrlByVersion(version: string): Promise<string> {
    // URLs de descarga basadas en la plataforma
    const platform = process.platform;
    const arch = process.arch === 'x64' ? 'x64' : 'x32';

    // Usar la API de Eclipse Adoptium para obtener la URL correcta
    const apiBaseUrl = 'https://api.adoptium.net/v3';
    
    // Parámetros de la solicitud
    const imageType = 'jdk';
    const jvmImpl = 'hotspot';
    const heapSize = 'normal';
    const vendor = 'eclipse';
    
    // Formatear la plataforma para la API
    let osFamily: string;
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
    
    const apiUrl = `${apiBaseUrl}/binary/latest/${version}/ga/${imageType}/${osFamily}/${arch}/${jvmImpl}/${heapSize}/${vendor}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Error al obtener la URL de descarga: ${response.status}`);
      }
      
      // La API debería redirigir a la URL de descarga real
      return response.url;
    } catch (error) {
      // En caso de error, usar URLs alternativas conocidas
      return this.getAlternativeDownloadUrl(version, osFamily, arch);
    }
  }

  private async downloadFile(url: string, destinationPath: string, onProgress?: (progress: JavaDownloadProgress) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode} - ${response.statusMessage}`));
          return;
        }

        const totalLength = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedLength = 0;

        const writeStream = createWriteStream(destinationPath);
        
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

        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      }).on('error', reject);

      // Establecer timeout
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  private async extractJavaArchive(archivePath: string, destinationDir: string): Promise<void> {
    const extension = path.extname(archivePath).toLowerCase();
    
    if (extension === '.zip') {
      // Usar una librería para descomprimir zip
      await this.extractZip(archivePath, destinationDir);
    } else if (extension === '.tar' || extension === '.gz' || archivePath.endsWith('.tar.gz')) {
      // Descomprimir archivo tar.gz
      await this.extractTarGz(archivePath, destinationDir);
    } else {
      throw new Error(`Formato de archivo no soportado: ${extension}`);
    }
  }

  private async extractZip(zipPath: string, destination: string): Promise<void> {
    // En una implementación real, usaríamos una librería como yauzl o extract-zip
    // Por ahora simulamos la extracción
    console.log(`Extrayendo ${zipPath} a ${destination}`);
    return Promise.resolve();
  }

  private async extractTarGz(tarPath: string, destination: string): Promise<void> {
    // En una implementación real, usaríamos la librería tar
    console.log(`Extrayendo ${tarPath} a ${destination}`);
    return Promise.resolve();
  }

  private findJavaBinary(extractDir: string): string | null {
    // Buscar el binario java en el directorio extraído
    const searchPaths = [
      path.join(extractDir, '*/bin/java'),
      path.join(extractDir, '*/bin/java.exe'),
      path.join(extractDir, 'Contents/Home/bin/java'),
      path.join(extractDir, 'bin/java'),
      path.join(extractDir, 'bin/java.exe'),
    ];

    for (const searchPattern of searchPaths) {
      const matches = this.globSync(searchPattern);
      if (matches.length > 0) {
        return matches[0];
      }
    }

    return null;
  }

  private globSync(pattern: string): string[] {
    // Implementación básica de glob (en una implementación real usaríamos la librería glob)
    const baseDir = path.dirname(pattern);
    const fileName = path.basename(pattern);

    if (!fs.existsSync(baseDir)) return [];

    if (fileName === '*/bin/java' || fileName === '*/bin/java.exe') {
      const subdirs = fs.readdirSync(baseDir).filter(item => 
        fs.statSync(path.join(baseDir, item)).isDirectory()
      );

      const results: string[] = [];
      for (const subdir of subdirs) {
        const subdirPath = path.join(baseDir, subdir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
        if (fs.existsSync(subdirPath)) {
          results.push(subdirPath);
        }
      }
      return results;
    }

    return [];
  }

  private getAlternativeDownloadUrl(version: string, osFamily: string, arch: string): string {
    // URLs alternativas por si la API falla
    const baseUrl = 'https://github.com/adoptium/temurin';
    
    if (version === '8') {
      return `https://github.com/adoptium/temurin8-binaries/releases/latest/download/OpenJDK8U-jdk_${arch}_${osFamily}_hotspot_*.msi`;
    } else if (version === '17') {
      return `https://github.com/adoptium/temurin17-binaries/releases/latest/download/OpenJDK17U-jdk_${arch}_${osFamily}_hotspot_*.msi`;
    } else if (version === '21') {
      return `https://github.com/adoptium/temurin21-binaries/releases/latest/download/OpenJDK21U-jdk_${arch}_${osFamily}_hotspot_*.msi`;
    }
    
    throw new Error(`No se encontró URL de descarga alternativa para Java ${version}`);
  }
}

export const javaDownloader = new JavaDownloader();