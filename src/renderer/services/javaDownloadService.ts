// src/renderer/services/javaDownloadService.ts
import { downloadService } from './downloadService';
import { settingsService } from './settingsService';
import { JavaInfo } from '../types/java.d';

// Declarar la interfaz de la API global de Java
declare global {
  interface Window {
    api: {
      java: {
        detect: () => Promise<JavaInfo[]>;
        test: (path: string) => Promise<any>;
        explore: () => Promise<string | null>;
        install: (version: string) => Promise<any>;
        getAll: () => Promise<JavaInfo[]>;
        getDefault: () => Promise<JavaInfo | null>;
        setDefault: (javaId: string) => Promise<boolean>;
        remove: (javaId: string) => Promise<boolean>;
        getCompatibility: (minecraftVersion: string) => Promise<any>;
      };
    };
  }
}

export class JavaDownloadService {
  private static readonly API_BASE_URL = 'https://api.adoptium.net/v3';

  /**
   * Obtiene la URL de descarga para una versión específica de Java
   * @param version - La versión de Java (8, 11, 17, 21)
   * @returns La URL de descarga para la versión de Java solicitada
   */
  async getJavaDownloadUrl(version: string, os?: string, arch?: string): Promise<string> {
    // Detectar sistema operativo y arquitectura si no se proporcionan
    const detectedOS = os || this.detectOS();
    const detectedArch = arch || this.detectArchitecture();

    // Formato correcto de la API v3 de Adoptium para instaladores
    // Documentado en https://api.adoptium.net/q/swagger-ui/
    // https://api.adoptium.net/v3/installer/latest/{feature_version}/{release_type}/{os}/{arch}/{image_type}/{jvm_impl}/{heap_size}/{vendor}
    // Ejemplo: https://api.adoptium.net/v3/installer/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse
    const apiUrl = `${JavaDownloadService.API_BASE_URL}/installer/latest/${version}/ga/${detectedOS}/${detectedArch}/jdk/hotspot/normal/eclipse`;

    // Devolvemos directamente la URL de la API, ya que el servicio de descargas manejará la redirección
    // y no podemos hacer HEAD requests a recursos externos debido a CORS
    return apiUrl;
  }

  /**
   * Inicia la descarga de una versión específica de Java
   * @param version - La versión de Java a descargar (8, 11, 17, 21)
   */
  async installJava(version: string, os?: string, arch?: string): Promise<void> {
    try {
      // Obtener la URL de descarga
      const downloadUrl = await this.getJavaDownloadUrl(version, os, arch);

      // Crear un nombre descriptivo para la descarga
      const osName = os || this.detectOS();
      const archName = arch || this.detectArchitecture();

      // Iniciar la descarga usando el servicio de descargas
      const download = downloadService.createDownload(downloadUrl, `Java ${version} (${osName}/${archName})`);

      // Iniciar la descarga con una actualización gradual del progreso
      await downloadService.startDownload(download.id);

      console.log(`Java ${version} comenzó a descargarse. ID: ${download.id}`);
    } catch (error) {
      console.error(`Error al iniciar la descarga de Java ${version}:`, error);
      throw error;
    }
  }

  /**
   * Detecta el sistema operativo del usuario
   */
  private detectOS(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('win')) {
      return 'windows';
    } else if (userAgent.includes('mac')) {
      return 'mac';
    } else if (userAgent.includes('linux')) {
      return 'linux';
    }
    
    // Por defecto, asumir Windows
    return 'windows';
  }

  /**
   * Detecta la arquitectura del sistema
   */
  private detectArchitecture(): string {
    // Para simplificar, devolvemos x64 por defecto
    // En una implementación real, esto dependería de la plataforma
    return 'x64';
  }

  /**
   * Valida si una versión de Java es compatible con Minecraft
   */
  getCompatibilityInfo(version: string): { recommended: boolean; note?: string } {
    const versionNum = parseInt(version, 10);
    
    if (versionNum < 8) {
      return { recommended: false, note: 'Versión mínima requerida: Java 8' };
    } else if (versionNum === 8) {
      return { 
        recommended: true, 
        note: 'Compatible con Minecraft 1.16.5 y anteriores' 
      };
    } else if (versionNum === 17) {
      return { 
        recommended: true, 
        note: 'Requerido para Minecraft 1.17+' 
      };
    } else if (versionNum === 21) {
      return { 
        recommended: true, 
        note: 'Compatible con las últimas versiones de Minecraft y mod loaders' 
      };
    } else {
      return { 
        recommended: false, 
        note: 'Versión recomendada: Java 8, 17 o 21' 
      };
    }
  }
}

export const javaDownloadService = new JavaDownloadService();