import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import fetch from 'node-fetch';
import { getLauncherDataPath } from '../utils/paths';
import { downloadQueueService } from './downloadQueueService';
import { ModrinthVersion } from './modDownloadService';

const pipelineAsync = promisify(pipeline);

/**
 * Servicio para manejar la descarga de contenido de Modrinth
 */
export class ModrinthDownloadService {
  
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
   * Obtiene todas las versiones disponibles de un proyecto en Modrinth
   * @param projectId ID del proyecto en Modrinth
   * @returns Lista de versiones disponibles
   */
  public async getAvailableVersions(
    projectId: string
  ): Promise<ModrinthVersion[]> {
    try {
      const versionsUrl = `https://api.modrinth.com/v2/project/${projectId}/version`;
      const response = await fetch(versionsUrl, {
        headers: {
          'User-Agent': 'DRK-Launcher/1.0 (contacto@drklauncher.com)'
        }
      });

      if (!response.ok) {
        throw new Error(`Error al obtener versiones del proyecto ${projectId}`);
      }

      const versions = await response.json();
      return versions as ModrinthVersion[];
    } catch (error) {
      console.error(`Error al obtener versiones del proyecto ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Filtra versiones para encontrar las compatibles
   * @param projectId ID del proyecto en Modrinth
   * @param mcVersion Versión de Minecraft objetivo
   * @param loader Tipo de mod loader (fabric, forge, etc.)
   * @returns Lista de versiones compatibles
   */
  public async getCompatibleVersions(
    projectId: string,
    mcVersion: string,
    loader?: string
  ): Promise<ModrinthVersion[]> {
    const allVersions = await this.getAvailableVersions(projectId);
    // Usar el método de filtro directamente en lugar del servicio
    return allVersions
      .filter(version =>
        version.game_versions.includes(mcVersion) &&
        (!loader || version.loaders.includes(loader.toLowerCase()))
      )
      .sort((a, b) =>
        new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
      );
  }

  /**
   * Descarga un mod, resource pack o shader pack simple
   * @param projectId ID del proyecto en Modrinth
   * @param versionId ID específico de la versión a descargar (opcional, si no se proporciona se usa la más reciente compatible)
   * @param instancePath Ruta de la instancia donde instalar
   * @param mcVersion Versión de Minecraft objetivo
   * @param loader Tipo de mod loader (fabric, forge, etc.)
   * @param contentType Tipo de contenido (mod, resourcepack, shader)
   */
  public async downloadContent(
    projectId: string,
    instancePath: string,
    mcVersion: string,
    loader?: string,
    contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack' = 'mod',
    versionId?: string  // Nuevo parámetro para seleccionar una versión específica
  ): Promise<void> {
    try {
      let targetVersion: ModrinthVersion | null = null;

      if (versionId) {
        // Si se especificó un ID de versión específico, buscar esa versión exacta
        const allVersions = await this.getAvailableVersions(projectId);
        targetVersion = allVersions.find(v => v.id === versionId) || null;
      } else {
        // De lo contrario, buscar versiones compatibles y tomar la más reciente
        const compatibleVersions = await this.getCompatibleVersions(projectId, mcVersion, loader);
        targetVersion = compatibleVersions.length > 0 ? compatibleVersions[0] : null;
      }

      if (!targetVersion) {
        const errorMessage = versionId
          ? `Versión específica ${versionId} no encontrada para el proyecto ${projectId}`
          : `No se encontró una versión compatible para ${mcVersion} y ${loader || 'cualquier loader'}`;
        throw new Error(errorMessage);
      }

      // Determinar carpeta de destino según tipo de contenido
      let targetDir: string;
      switch (contentType) {
        case 'mod':
          targetDir = path.join(instancePath, 'mods');
          break;
        case 'resourcepack':
          targetDir = path.join(instancePath, 'resourcepacks');
          break;
        case 'shader':
          targetDir = path.join(instancePath, 'shaderpacks');
          break;
        case 'datapack':
          targetDir = path.join(instancePath, 'datapacks');
          break;
        default:
          throw new Error(`Tipo de contenido no soportado: ${contentType}`);
      }

      this.ensureDir(targetDir);

      // Obtener archivo principal (el que está marcado como primario o el primero)
      const primaryFile = targetVersion.files.find(f => f.primary) || targetVersion.files[0];
      if (!primaryFile) {
        throw new Error(`No se encontraron archivos para la versión ${targetVersion.id} del proyecto ${projectId}`);
      }

      const downloadUrl = primaryFile.url;

      // Verificar si ya existe un archivo con el mismo nombre en la carpeta
      const fileName = primaryFile.filename;
      const filePath = path.join(targetDir, fileName);

      // Si el archivo ya existe, verificar si se quiere sobrescribir o generar un nombre único
      let finalPath = filePath;
      if (fs.existsSync(filePath)) {
        // Generar nombre único para evitar sobrescritura
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        let counter = 1;
        let uniqueFileName;

        do {
          uniqueFileName = `${nameWithoutExt}_${counter}${ext}`;
          finalPath = path.join(targetDir, uniqueFileName);
          counter++;
        } while (fs.existsSync(finalPath));
      }

      // Descargar archivo
      await this.downloadFile(downloadUrl, finalPath);
      console.log(`Descargado ${fileName} en ${targetDir}`);
    } catch (error) {
      console.error(`Error al descargar contenido ${contentType} ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Descarga e instala un modpack (.mrpack)
   * @param projectId ID del proyecto en Modrinth
   * @param instancePath Ruta de la instancia donde instalar
   * @param mcVersion Versión de Minecraft objetivo
   * @param loader Tipo de mod loader (fabric, forge, etc.)
   */
  public async downloadModpack(
    projectId: string, 
    instancePath: string, 
    mcVersion: string, 
    loader?: string
  ): Promise<void> {
    try {
      // Obtener información de la versión que coincida con la versión de MC y loader
      const versionsUrl = `https://api.modrinth.com/v2/project/${projectId}/version`;
      const response = await fetch(versionsUrl, {
        headers: {
          'User-Agent': 'DRK-Launcher/1.0 (contacto@drklauncher.com)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error al obtener versiones del proyecto ${projectId}`);
      }
      
      const versions = await response.json();
      
      // Buscar la versión que coincida con la versión de Minecraft y loader
      const targetVersion = this.findMatchingVersion(versions, mcVersion, loader);
      if (!targetVersion) {
        throw new Error(`No se encontró una versión compatible para ${mcVersion} y ${loader || 'cualquier loader'}`);
      }
      
      // Obtener URL de descarga del archivo .mrpack
      const downloadUrl = targetVersion.files[0]?.url;
      if (!downloadUrl) {
        throw new Error(`No se encontró URL de descarga para el proyecto ${projectId}`);
      }
      
      // Descargar archivo .mrpack temporalmente
      const tempDir = path.join(instancePath, '.temp');
      this.ensureDir(tempDir);
      
      const tempPackPath = path.join(tempDir, targetVersion.files[0]?.filename || 'modpack.mrpack');
      await this.downloadFile(downloadUrl, tempPackPath);
      
      // Extraer el .mrpack (es un ZIP) y leer el manifiesto
      const manifest = await this.extractModpackManifest(tempPackPath);
      
      // Procesar el manifiesto e instalar cada componente
      await this.processModpackManifest(manifest, instancePath, tempDir);
      
      // Limpiar archivos temporales
      if (fs.existsSync(tempPackPath)) {
        fs.unlinkSync(tempPackPath);
      }
      
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
      
      console.log(`Modpack ${projectId} instalado correctamente`);
    } catch (error) {
      console.error(`Error al instalar modpack ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Busca la versión que coincida con los criterios
   */
  private findMatchingVersion(versions: any[], mcVersion: string, loader?: string): any | null {
    // Filtrar por versión de juego
    let compatibleVersions = versions.filter((version: any) => 
      version.game_versions.includes(mcVersion)
    );
    
    // Si se especificó un loader, filtrar también por loader
    if (loader) {
      compatibleVersions = compatibleVersions.filter((version: any) =>
        version.loaders.includes(loader.toLowerCase())
      );
    }
    
    // Devolver la versión más reciente (ordenadas por fecha)
    if (compatibleVersions.length > 0) {
      return compatibleVersions.sort((a, b) => 
        new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
      )[0];
    }
    
    return null;
  }

  /**
   * Extrae el manifiesto de un archivo .mrpack
   */
  private async extractModpackManifest(packPath: string): Promise<any> {
    const nodeStreamZip = require('node-stream-zip');
    if (!nodeStreamZip) {
      throw new Error('node-stream-zip no está disponible');
    }

    return new Promise((resolve, reject) => {
      try {
        const zip = new nodeStreamZip({
          file: packPath,
          storeEntries: true
        });

        zip.on('ready', () => {
          try {
            // Buscar el archivo de manifiesto
            const manifestEntry = Object.keys(zip.entries()).find(entry =>
              entry === 'modrinth.index.json' || entry.endsWith('modrinth.index.json')
            );

            if (!manifestEntry) {
              reject(new Error('No se encontró el archivo modrinth.index.json en el modpack'));
              zip.close();
              return;
            }

            // Usar el método de lectura de entrada correcto
            try {
              const entry = zip.entry(manifestEntry);
              if (!entry) {
                reject(new Error('No se pudo acceder a la entrada del archivo'));
                zip.close();
                return;
              }

              // Leer datos usando el stream de la entrada
              const stream = zip.stream(manifestEntry, (err: Error | null, stm: any) => {
                if (err) {
                  reject(err);
                  zip.close();
                  return;
                }

                const chunks: Buffer[] = [];
                stm.on('data', (chunk: Buffer) => chunks.push(chunk));

                stm.on('end', () => {
                  try {
                    const data = Buffer.concat(chunks);
                    const manifest = JSON.parse(data.toString('utf-8'));
                    zip.close();
                    resolve(manifest);
                  } catch (parseError) {
                    zip.close();
                    reject(parseError);
                  }
                });

                stm.on('error', (streamErr: Error) => {
                  zip.close();
                  reject(streamErr);
                });
              });
            } catch (readError) {
              zip.close();
              reject(readError);
            }
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

  /**
   * Procesa el manifiesto de un modpack e instala los componentes
   */
  private async processModpackManifest(manifest: any, instancePath: string, tempDir: string): Promise<void> {
    if (!manifest.dependencies || !manifest.files) {
      throw new Error('El manifiesto del modpack no tiene la estructura esperada');
    }

    const files = manifest.files;

    for (const file of files) {
      // Determinar carpeta de destino basada en la ruta en el manifiesto
      let targetDir: string;
      let isConfigFile = false;

      // Ruta dentro del modpack
      const filePath = file.path;
      const downloads = file.downloads;

      if (filePath.startsWith('mods/')) {
        targetDir = path.join(instancePath, 'mods');
      } else if (filePath.startsWith('resourcepacks/')) {
        targetDir = path.join(instancePath, 'resourcepacks');
      } else if (filePath.startsWith('shaderpacks/')) {
        targetDir = path.join(instancePath, 'shaderpacks');
      } else if (filePath.startsWith('config/')) {
        // Archivos de configuración van directamente a la carpeta config de la instancia
        targetDir = path.join(instancePath, 'config');
        isConfigFile = true;
      } else if (filePath.startsWith('datapacks/')) {
        targetDir = path.join(instancePath, 'datapacks');
      } else {
        // Para otros archivos que no están en carpetas específicas,
        // intentar adivinar la carpeta destino o simplemente descargarlos
        // por ahora, los ponemos en la raíz de la instancia
        targetDir = instancePath;
      }

      this.ensureDir(targetDir);

      // Si el archivo tiene URLs de descarga, descargarlo
      if (downloads && downloads.length > 0) {
        const downloadUrl = downloads[0];
        const fileName = path.basename(filePath);
        const targetPath = path.join(targetDir, fileName);

        // Verificar si el archivo ya existe
        if (!fs.existsSync(targetPath)) {
          await this.downloadFile(downloadUrl, targetPath);
          console.log(`Descargado ${fileName} a ${targetDir}`);
        }
      }
      // Nota: La lógica de extracción desde el .mrpack se maneja antes de llamar a esta función
      // cuando se procesa el archivo modrinth.index.json
    }
  }

  /**
   * Descarga un archivo
   */
  private async downloadFile(url: string, outputPath: string): Promise<void> {
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
}

export const modrinthDownloadService = new ModrinthDownloadService();