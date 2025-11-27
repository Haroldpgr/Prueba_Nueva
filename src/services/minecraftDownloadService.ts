import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import fetch from 'node-fetch';
import { basePaths } from '../main/main';
import { getLauncherDataPath } from '../utils/paths';
import { downloadQueueService } from './downloadQueueService';

const pipelineAsync = promisify(pipeline);

/**
 * Servicio para manejar la descarga de versiones base de Minecraft
 */
export class MinecraftDownloadService {
  private versionsPath: string;
  private librariesPath: string;
  private assetsPath: string;

  constructor() {
    const launcherPath = getLauncherDataPath();
    this.versionsPath = path.join(launcherPath, 'versions');
    this.librariesPath = path.join(launcherPath, 'libraries');
    this.assetsPath = path.join(launcherPath, 'assets');
    
    this.ensureDir(this.versionsPath);
    this.ensureDir(this.librariesPath);
    this.ensureDir(this.assetsPath);
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
   * Descarga la metadata de una versión específica de Minecraft
   * @param version Versión de Minecraft (por ejemplo, '1.20.1')
   * @returns Ruta al archivo version.json
   */
  public async downloadVersionMetadata(version: string): Promise<string> {
    const versionDir = path.join(this.versionsPath, version);
    this.ensureDir(versionDir);
    
    const versionJsonPath = path.join(versionDir, 'version.json');
    
    // Verificar si ya existe la metadata
    if (fs.existsSync(versionJsonPath)) {
      console.log(`Metadata de la versión ${version} ya existe`);
      return versionJsonPath;
    }

    try {
      // Obtener URL de metadata desde Mojang
      const manifestResponse = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      const manifest = await manifestResponse.json();
      
      const versionInfo = manifest.versions.find((v: any) => v.id === version);
      if (!versionInfo) {
        throw new Error(`Versión ${version} no encontrada en el manifest`);
      }

      const versionMetadataResponse = await fetch(versionInfo.url);
      const versionMetadata = await versionMetadataResponse.json();
      
      // Guardar metadata
      fs.writeFileSync(versionJsonPath, JSON.stringify(versionMetadata, null, 2));
      
      console.log(`Metadata de la versión ${version} descargada`);
      return versionJsonPath;
    } catch (error) {
      console.error(`Error al descargar metadata de la versión ${version}:`, error);
      throw error;
    }
  }

  /**
   * Descarga las librerías base de una versión de Minecraft
   * @param version Versión de Minecraft
   */
  public async downloadVersionLibraries(version: string): Promise<void> {
    const versionJsonPath = await this.downloadVersionMetadata(version);
    const versionMetadata = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    
    const libraries = versionMetadata.libraries || [];
    
    console.log(`Descargando ${libraries.length} librerías para la versión ${version}...`);
    
    for (const library of libraries) {
      await this.downloadLibrary(library);
    }
    
    console.log(`Descarga de librerías para la versión ${version} completada`);
  }

  /**
   * Descarga una librería específica
   * @param library Objeto de librería desde el version.json
   */
  private async downloadLibrary(library: any): Promise<void> {
    // Verificar reglas de compatibilidad
    if (library.rules) {
      const allowed = this.isLibraryAllowed(library.rules);
      if (!allowed) {
        console.log(`Librería ${library.name} no permitida en este sistema, omitiendo...`);
        return;
      }
    }

    const downloads = library.downloads;
    if (!downloads || !downloads.artifact) {
      console.log(`Librería ${library.name} no tiene URLs de descarga, omitiendo...`);
      return;
    }

    const artifact = downloads.artifact;
    const libraryPath = this.getLibraryPath(library.name);
    const libraryDir = path.dirname(libraryPath);
    
    this.ensureDir(libraryDir);

    // Verificar si la librería ya existe
    if (fs.existsSync(libraryPath)) {
      console.log(`Librería ${library.name} ya existe, omitiendo...`);
      return;
    }

    try {
      await this.downloadFile(artifact.url, libraryPath);
      console.log(`Librería ${library.name} descargada`);
    } catch (error) {
      console.error(`Error al descargar librería ${library.name}:`, error);
    }
  }

  /**
   * Verifica si una librería está permitida según las reglas
   */
  private isLibraryAllowed(rules: any[]): boolean {
    let allowed = false;
    
    for (const rule of rules) {
      const osName = rule.os?.name;
      const action = rule.action;
      
      if (osName) {
        // Determinar sistema operativo actual
        let currentOs = '';
        switch (process.platform) {
          case 'win32': currentOs = 'windows'; break;
          case 'darwin': currentOs = 'osx'; break;
          case 'linux': currentOs = 'linux'; break;
          default: currentOs = 'linux';
        }
        
        if (osName === currentOs) {
          allowed = action === 'allow';
        } else if (!osName && action === 'allow') {
          allowed = true;
        }
      } else if (!osName) {
        allowed = action === 'allow';
      }
    }
    
    return allowed;
  }

  /**
   * Convierte el nombre de la librería al formato de ruta
   * Ej: net.minecraft:client:1.20.1 -> net/minecraft/client/1.20.1/client-1.20.1.jar
   */
  private getLibraryPath(libraryName: string): string {
    const [group, artifact, version] = libraryName.split(':');
    const artifactWithoutClassifier = artifact.split('@')[0]; // Remover extensión si está presente
    const ext = artifact.includes('@') ? artifact.split('@')[1] : 'jar';
    
    const parts = group.split('.');
    const libraryDir = path.join(this.librariesPath, ...parts, artifactWithoutClassifier, version);
    const fileName = `${artifactWithoutClassifier}-${version}.${ext}`;
    
    return path.join(libraryDir, fileName);
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

  /**
   * Descarga el archivo client.jar para una versión específica
   * @param version Versión de Minecraft
   * @param instancePath Ruta de la instancia donde colocar el client.jar
   */
  public async downloadClientJar(version: string, instancePath: string): Promise<string> {
    const clientJarPath = path.join(instancePath, 'client.jar');
    
    // Verificar si ya existe
    if (fs.existsSync(clientJarPath)) {
      console.log(`client.jar ya existe para la versión ${version}`);
      return clientJarPath;
    }

    const versionJsonPath = await this.downloadVersionMetadata(version);
    const versionMetadata = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    
    const clientDownloadUrl = versionMetadata.downloads?.client?.url;
    if (!clientDownloadUrl) {
      throw new Error(`No se encontró URL de descarga para client.jar de la versión ${version}`);
    }

    try {
      await this.downloadFile(clientDownloadUrl, clientJarPath);
      console.log(`client.jar descargado para la versión ${version}`);
      return clientJarPath;
    } catch (error) {
      console.error(`Error al descargar client.jar para la versión ${version}:`, error);
      throw error;
    }
  }
}

export const minecraftDownloadService = new MinecraftDownloadService();