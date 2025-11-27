import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import fetch from 'node-fetch';

const pipelineAsync = promisify(pipeline);

/**
 * Interfaz para la información de descarga
 */
export interface DownloadInfo {
  id: string;
  url: string;
  outputPath: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
  totalBytes?: number;
  downloadedBytes?: number;
}

/**
 * Servicio para manejar colas de descargas concurrentes
 */
export class DownloadQueueService {
  private downloads: Map<string, DownloadInfo> = new Map();
  private activeDownloads: Set<string> = new Set();
  private maxConcurrentDownloads: number = 3; // Limitar descargas concurrentes
  private timeoutMs: number = 30000; // 30 segundos de timeout por defecto

  /**
   * Añade una descarga a la cola
   */
  async addDownload(url: string, outputPath: string): Promise<string> {
    const downloadId = this.generateId();
    const downloadInfo: DownloadInfo = {
      id: downloadId,
      url,
      outputPath,
      progress: 0,
      status: 'pending'
    };

    this.downloads.set(downloadId, downloadInfo);
    this.processQueue();

    return downloadId;
  }

  /**
   * Inicia una descarga individual con manejo de errores y timeouts
   */
  private async startDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download || download.status !== 'pending') {
      return;
    }

    this.activeDownloads.add(downloadId);
    download.status = 'downloading';

    try {
      // Crear directorio si no existe
      const dir = path.dirname(download.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Configurar timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(download.url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Obtener tamaño total
      const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
      download.totalBytes = totalBytes;
      download.downloadedBytes = 0;

      // Crear stream de escritura
      const fileStream = fs.createWriteStream(download.outputPath);

      // Controlar progreso
      const progressStream = new (require('stream').Transform)({
        transform(chunk: Buffer, encoding: string, callback: (error: Error | null, data?: Buffer) => void) {
          download.downloadedBytes = (download.downloadedBytes || 0) + chunk.length;
          download.progress = totalBytes > 0 ? download.downloadedBytes! / totalBytes : 0;
          callback(null, chunk);
        }
      });

      // Conectar streams
      response.body
        .on('error', (err) => {
          fileStream.destroy(err);
          progressStream.destroy(err);
        })
        .pipe(progressStream)
        .pipe(fileStream);

      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        progressStream.on('error', reject);
      });

      download.status = 'completed';
      download.progress = 1;
    } catch (error: any) {
      download.status = 'error';
      download.error = error.message || 'Unknown error';
      download.progress = 0;

      // Limpiar archivo si hubo error
      if (fs.existsSync(download.outputPath)) {
        try {
          fs.unlinkSync(download.outputPath);
        } catch (unlinkError) {
          console.error('Error removing failed download file:', unlinkError);
        }
      }
    } finally {
      this.activeDownloads.delete(downloadId);
      this.processQueue(); // Procesar siguiente descarga en la cola
    }
  }

  /**
   * Procesa la cola de descargas
   */
  private processQueue(): void {
    // Obtener descargas pendientes que no estén activas
    const pendingDownloads = Array.from(this.downloads.entries())
      .filter(([_, info]) => info.status === 'pending' && !this.activeDownloads.has(info.id))
      .slice(0, this.maxConcurrentDownloads - this.activeDownloads.size);

    for (const [_, download] of pendingDownloads) {
      if (this.activeDownloads.size < this.maxConcurrentDownloads) {
        // Iniciar descarga en segundo plano
        this.startDownload(download.id).catch(error => {
          console.error(`Error in download ${download.id}:`, error);
          const downloadInfo = this.downloads.get(download.id);
          if (downloadInfo) {
            downloadInfo.status = 'error';
            downloadInfo.error = error.message;
          }
          this.activeDownloads.delete(download.id);
        });
      }
    }
  }

  /**
   * Obtiene el estado de una descarga
   */
  getDownloadStatus(downloadId: string): DownloadInfo | undefined {
    return this.downloads.get(downloadId);
  }

  /**
   * Cancela una descarga en progreso
   */
  cancelDownload(downloadId: string): boolean {
    const download = this.downloads.get(downloadId);
    if (!download) {
      return false;
    }

    if (download.status === 'pending') {
      download.status = 'error';
      download.error = 'Download cancelled';
      return true;
    }

    // Para descargas activas, no podemos cancelarlas fácilmente
    // pero podemos marcarlas para que se ignoren
    if (download.status === 'downloading') {
      // La descarga seguirá hasta completar o fallar, pero no se procesará después
      return true;
    }

    return false;
  }

  /**
   * Reinicia una descarga fallida
   */
  async restartDownload(downloadId: string): Promise<string | null> {
    const download = this.downloads.get(downloadId);
    if (!download || download.status !== 'error') {
      return null;
    }

    // Cambiar estado a pendiente para reiniciar
    download.status = 'pending';
    download.progress = 0;
    download.error = undefined;

    this.processQueue();
    return downloadId;
  }

  /**
   * Obtiene todas las descargas
   */
  getAllDownloads(): DownloadInfo[] {
    return Array.from(this.downloads.values());
  }

  /**
   * Genera un ID único para la descarga
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Obtiene el número de descargas activas
   */
  getActiveDownloadCount(): number {
    return this.activeDownloads.size;
  }

  /**
   * Obtiene el número total de descargas en cola
   */
  getTotalDownloadCount(): number {
    return this.downloads.size;
  }
}

export const downloadQueueService = new DownloadQueueService();