// src/renderer/services/downloadService.ts
import { settingsService } from './settingsService';

export interface Download {
  id: string;
  name: string;
  url: string;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  startTime: number;
  endTime?: number;
  speed: number; // bytes per second
  path?: string;
}

export class DownloadService {
  private downloads: Map<string, Download> = new Map();
  private observers: Array<(downloads: Download[]) => void> = [];

  subscribe(callback: (downloads: Download[]) => void) {
    this.observers.push(callback);
    // Notificar inmediatamente con la lista actual
    callback(this.getAllDownloads());
    
    return () => {
      this.observers = this.observers.filter(obs => obs !== callback);
    };
  }

  private notifyObservers() {
    const downloadsArray = this.getAllDownloads();
    this.observers.forEach(observer => observer(downloadsArray));
  }

  createDownload(url: string, name: string): Download {
    const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDownload: Download = {
      id: downloadId,
      name,
      url,
      status: 'pending',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      startTime: Date.now(),
      speed: 0
    };
    
    this.downloads.set(downloadId, newDownload);
    this.notifyObservers();
    
    return newDownload;
  }

  async startDownload(downloadId: string) {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    if (download.status === 'completed') {
      // Reiniciar descarga si ya está completada
      download.progress = 0;
      download.downloadedBytes = 0;
      download.totalBytes = 0;
      download.startTime = Date.now();
      download.speed = 0;
    }

    download.status = 'downloading';
    this.notifyObservers();

    try {
      // En una implementación real, usaríamos el API de Electron para descargar
      // Por ahora, simularemos la descarga
      await this.simulateDownload(download);
    } catch (error) {
      console.error('Error downloading file:', error);
      download.status = 'error';
      this.notifyObservers();
    }
  }

  private async simulateDownload(download: Download) {
    try {
      // Intentar una descarga real de la URL proporcionada
      // Hacer una request HEAD para obtener el tamaño del archivo
      const headResponse = await fetch(download.url, {
        method: 'HEAD',
        mode: 'no-cors' // Permite manejar recursos externos aunque no podamos leer la respuesta completa
      });

      // Si no podemos hacer HEAD request debido a CORS, usar valores por defecto
      let totalBytes = 50 * 1024 * 1024; // 50MB por defecto

      if (headResponse.ok && headResponse.headers.get('content-length')) {
        totalBytes = parseInt(headResponse.headers.get('content-length') || '0', 10) || totalBytes;
      }

      download.totalBytes = totalBytes;

      // Simular la descarga con progreso real
      let downloadedBytes = 0;
      const chunkSize = 2 * 1024 * 1024; // 2MB por chunk
      const interval = 500; // ms por chunk

      // Iniciar descarga
      while (downloadedBytes < totalBytes && download.status === 'downloading') {
        const chunk = Math.min(chunkSize, totalBytes - downloadedBytes);
        downloadedBytes += chunk;

        // Actualizar estadísticas
        download.downloadedBytes = downloadedBytes;
        download.progress = Math.round((downloadedBytes / totalBytes) * 100);

        // Calcular velocidad (bytes por segundo)
        const elapsedSeconds = (Date.now() - download.startTime) / 1000;
        download.speed = elapsedSeconds > 0 ? Math.round(downloadedBytes / elapsedSeconds) : 0;

        this.notifyObservers();

        // Esperar un poco
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      if (download.status === 'downloading') {
        download.status = 'completed';
        download.endTime = Date.now();
        download.progress = 100;
        download.downloadedBytes = totalBytes;
        this.notifyObservers();
      }
    } catch (error) {
      console.error(`Error during download simulation for ${download.id}:`, error);
      // Marcar como completado con error
      download.status = 'error';
      download.endTime = Date.now();
      this.notifyObservers();
    }
  }

  pauseDownload(downloadId: string) {
    const download = this.downloads.get(downloadId);
    if (download && download.status === 'downloading') {
      download.status = 'paused';
      this.notifyObservers();
    }
  }

  resumeDownload(downloadId: string) {
    const download = this.downloads.get(downloadId);
    if (download && download.status === 'paused') {
      this.startDownload(downloadId);
    }
  }

  cancelDownload(downloadId: string) {
    const download = this.downloads.get(downloadId);
    if (download) {
      download.status = 'error';
      this.notifyObservers();
      // Remover después de un tiempo para no dejar entradas huérfanas
      setTimeout(() => {
        this.downloads.delete(downloadId);
        this.notifyObservers();
      }, 5000);
    }
  }

  getDownload(downloadId: string): Download | undefined {
    return this.downloads.get(downloadId);
  }

  getAllDownloads(): Download[] {
    return Array.from(this.downloads.values()).sort((a, b) => b.startTime - a.startTime);
  }

  getActiveDownloads(): Download[] {
    return Array.from(this.downloads.values())
      .filter(d => d.status === 'downloading' || d.status === 'paused')
      .sort((a, b) => b.startTime - a.startTime);
  }

  getCompletedDownloads(): Download[] {
    return Array.from(this.downloads.values())
      .filter(d => d.status === 'completed')
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
  }

  clearCompleted() {
    const completedIds = Array.from(this.downloads.entries())
      .filter(([_, download]) => download.status === 'completed')
      .map(([id, _]) => id);
    
    completedIds.forEach(id => this.downloads.delete(id));
    this.notifyObservers();
  }

  // Método especial para descargar Java desde Adoptium API
  async downloadJavaFromAdoptium(javaVersion: string, osFamily: string, arch: string): Promise<Download> {
    const apiUrl = `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/jdk/temurin/${osFamily}/${arch}/normal/hotspot/jdk`;

    // Hacer solicitud para obtener la URL de descarga
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Error al obtener la URL de descarga: ${response.status}`);
      }

      const downloadInfo = await response.json();
      const downloadUrl = downloadInfo.uri || downloadInfo.binary.link; // Adaptar según formato real de la API
      
      const download = this.createDownload(
        downloadUrl,
        `Java ${javaVersion} (${osFamily}/${arch})`
      );

      await this.startDownload(download.id);
      return download;
    } catch (error) {
      console.error('Error downloading Java from Adoptium:', error);
      const download = this.createDownload(
        '',
        `Java ${javaVersion} (${osFamily}/${arch})`
      );
      download.status = 'error';
      download.name = `Error: Java ${javaVersion} (${osFamily}/${arch})`;
      this.notifyObservers();
      throw error;
    }
  }
}

export const downloadService = new DownloadService();