import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import fetch from 'node-fetch';
import { getLauncherDataPath } from '../utils/paths';
import { downloadQueueService } from './downloadQueueService';

const pipelineAsync = promisify(pipeline);

/**
 * Servicio para manejar la descarga e instalación de Java
 */
export class JavaDownloadService {
  private runtimePath: string;

  constructor() {
    this.runtimePath = path.join(getLauncherDataPath(), 'runtime');
    this.ensureDir(this.runtimePath);
  }

  /**
   * Asegura que un directorio exista, creándolo si es necesario
   * @param dir Directorio a asegurar
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Detecta el sistema operativo y arquitectura
   */
  private getSystemInfo(): { os: string; arch: string } {
    const platform = process.platform;
    const arch = process.arch;

    let os: string;
    switch (platform) {
      case 'win32': os = 'windows'; break;
      case 'darwin': os = 'mac'; break;
      case 'linux': os = 'linux'; break;
      default: os = 'linux'; // Por defecto
    }

    let javaArch: string;
    switch (arch) {
      case 'x64': javaArch = 'x64'; break;
      case 'arm64': javaArch = 'aarch64'; break;
      case 'ia32': javaArch = 'x32'; break;
      default: javaArch = 'x64'; // Por defecto
    }

    return { os, arch: javaArch };
  }

  /**
   * Descarga e instala una versión específica de Java
   * @param javaVersion Versión de Java (por ejemplo, '17', '11', '8')
   * @returns Ruta al ejecutable java
   */
  public async downloadJava(javaVersion: string = '17'): Promise<string> {
    const { os, arch } = this.getSystemInfo();
    const javaDir = path.join(this.runtimePath, `java${javaVersion}`);
    this.ensureDir(javaDir);

    // Verificar si Java ya está instalado
    const javaExePath = path.join(javaDir, 'bin', os === 'windows' ? 'java.exe' : 'java');
    if (fs.existsSync(javaExePath)) {
      console.log(`Java ${javaVersion} ya está instalado en ${javaDir}`);
      return javaExePath;
    }

    console.log(`Descargando Java ${javaVersion} para ${os}-${arch}...`);

    // URL de la API de Adoptium para obtener información de la versión
    const apiURL = `https://api.adoptium.net/v3/assets/latest/${javaVersion}/hotspot?os=${os}&architecture=${arch}&image_type=jdk&vendor=eclipse`;
    
    try {
      const response = await fetch(apiURL);
      if (!response.ok) {
        throw new Error(`Error al obtener información de Java ${javaVersion}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        throw new Error(`No se encontró Java ${javaVersion} disponible para ${os}-${arch}`);
      }

      const binary = data[0];
      const downloadUrl = binary.binary.package.link;
      const checksum = binary.binary.package.checksum;

      // Descargar archivo
      const tempZipPath = path.join(this.runtimePath, `java${javaVersion}_temp.zip`);
      await this.downloadFile(downloadUrl, tempZipPath, checksum);

      // Extraer archivo ZIP
      await this.extractJavaArchive(tempZipPath, javaDir);

      // Eliminar archivo temporal
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }

      console.log(`Java ${javaVersion} instalado correctamente en ${javaDir}`);
      return javaExePath;
    } catch (error) {
      console.error(`Error al descargar Java ${javaVersion}:`, error);
      throw error;
    }
  }

  /**
   * Descarga un archivo con verificación de checksum
   */
  private async downloadFile(url: string, outputPath: string, expectedChecksum: string): Promise<void> {
    // Usar el servicio de cola de descargas para manejar timeouts y errores
    const downloadId = await downloadQueueService.addDownload(url, outputPath);

    // Esperar a que la descarga se complete
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const status = downloadQueueService.getDownloadStatus(downloadId);
        if (!status) {
          reject(new Error(`Download ${downloadId} not found`));
          return;
        }

        if (status.status === 'completed') {
          resolve();
        } else if (status.status === 'error') {
          reject(new Error(status.error || 'Download failed'));
        } else {
          // Continuar verificando cada 500ms
          setTimeout(checkStatus, 500);
        }
      };

      checkStatus();
    });
  }

  /**
   * Extrae el archivo ZIP de Java en la carpeta de destino
   */
  private async extractJavaArchive(archivePath: string, extractTo: string): Promise<void> {
    const nodeStreamZip = require('node-stream-zip');
    if (!nodeStreamZip) {
      throw new Error('node-stream-zip no está disponible');
    }

    return new Promise((resolve, reject) => {
      try {
        const zip = new nodeStreamZip({
          file: archivePath,
          storeEntries: true
        });

        zip.on('ready', () => {
          try {
            // Extraer todo el contenido
            zip.extract(null, extractTo, (err: Error | null) => {
              zip.close();
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          } catch (error) {
            zip.close();
            reject(error);
          }
        });

        zip.on('error', (err: Error) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const javaDownloadService = new JavaDownloadService();