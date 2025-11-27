import path from 'node:path';
import fs from 'node:fs';
import { instanceService, InstanceConfig } from './instanceService';
import { javaDownloadService } from './javaDownloadService';
import { minecraftDownloadService } from './minecraftDownloadService';
import { modrinthDownloadService } from './modrinthDownloadService';
import { downloadQueueService, DownloadInfo } from './downloadQueueService';

/**
 * Servicio maestro para manejar la creación completa de instancias
 * Sigue el proceso de 3 fases descrito en la especificación
 */
export class InstanceCreationService {
  
  /**
   * Crea una instancia completa paso a paso
   * @param name Nombre de la instancia
   * @param version Versión de Minecraft (ej. '1.20.1')
   * @param loader Loader a usar ('vanilla', 'fabric', 'forge', etc.)
   * @param javaVersion Versión de Java a usar (por defecto '17')
   */
  async createFullInstance(
    name: string,
    version: string,
    loader: InstanceConfig['loader'] = 'vanilla',
    javaVersion: string = '17'
  ): Promise<InstanceConfig> {
    console.log(`Iniciando creación de instancia: ${name} (${version}, ${loader})`);

    // FASE 1: Preparación del entorno - Descarga de Java
    console.log('FASE 1: Preparando entorno (descargando Java si es necesario)...');
    const javaPath = await this.setupJavaEnvironment(javaVersion);

    // PASO 2.1: Crear la estructura de la instancia
    console.log('PASO 2.1: Creando estructura de instancia...');
    const instance = instanceService.createInstance({
      name,
      version,
      loader
    });

    // PASO 2.2: Descarga de archivos base de Minecraft
    console.log('PASO 2.2: Descargando metadata y librerías de Minecraft...');
    await this.downloadMinecraftBase(version);

    // PASO 2.3: Descarga del cliente y loader
    console.log('PASO 2.3: Descargando cliente de Minecraft...');
    await this.downloadClientForInstance(version, loader, instance.path);

    console.log(`Instancia ${name} (ID: ${instance.id}) creada exitosamente en ${instance.path}`);

    return instance;
  }
  
  /**
   * FASE 1: Preparación del entorno - Descarga de Java
   */
  private async setupJavaEnvironment(javaVersion: string): Promise<string> {
    try {
      const javaPath = await javaDownloadService.downloadJava(javaVersion);
      console.log(`Java ${javaVersion} listo en: ${javaPath}`);
      return javaPath;
    } catch (error) {
      console.error('Error al preparar el entorno de Java:', error);
      throw error;
    }
  }
  
  /**
   * PASO 2.2: Descarga de archivos base de Minecraft (metadata y librerías)
   */
  private async downloadMinecraftBase(version: string): Promise<void> {
    try {
      // Descargar metadata de la versión
      await minecraftDownloadService.downloadVersionMetadata(version);
      
      // Descargar librerías base (esto puede tomar tiempo)
      await minecraftDownloadService.downloadVersionLibraries(version);
      
      console.log(`Archivos base de Minecraft ${version} descargados`);
    } catch (error) {
      console.error(`Error al descargar archivos base de Minecraft ${version}:`, error);
      throw error;
    }
  }
  
  /**
   * PASO 2.3: Descarga del cliente y loader para la instancia específica
   */
  private async downloadClientForInstance(
    version: string, 
    loader: InstanceConfig['loader'], 
    instancePath: string
  ): Promise<void> {
    try {
      // Si es vanilla, descargar directamente el client.jar
      if (loader === 'vanilla') {
        await minecraftDownloadService.downloadClientJar(version, instancePath);
      } else {
        // Para otros loaders (fabric, forge, etc.), necesitamos descargar el loader
        // y combinarlo con el cliente base
        await this.downloadLoaderAndMerge(version, loader, instancePath);
      }
      
      console.log(`Cliente de Minecraft ${version} con ${loader} listo en ${instancePath}`);
    } catch (error) {
      console.error(`Error al descargar cliente para ${version} con ${loader}:`, error);
      throw error;
    }
  }
  
  /**
   * Descarga y combina un mod loader con el cliente base
   */
  private async downloadLoaderAndMerge(
    version: string, 
    loader: InstanceConfig['loader'], 
    instancePath: string
  ): Promise<void> {
    // Esta lógica dependerá del loader específico
    // Por ejemplo, para Fabric:
    if (loader === 'fabric') {
      await this.downloadFabricLoader(version, instancePath);
    } else if (loader === 'forge') {
      await this.downloadForgeLoader(version, instancePath);
    } else if (loader === 'quilt') {
      await this.downloadQuiltLoader(version, instancePath);
    } else {
      // Si no es un loader conocido, usar vanilla
      await minecraftDownloadService.downloadClientJar(version, instancePath);
    }
  }
  
  /**
   * Descarga el loader de Fabric
   */
  private async downloadFabricLoader(version: string, instancePath: string): Promise<void> {
    // Obtener versión compatible de Fabric API
    const fabricApiUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}`;
    const response = await fetch(fabricApiUrl);
    const fabricVersions = await response.json();
    
    // Tomar la última versión estable
    const latestFabric = fabricVersions.find((v: any) => v.loader.stable);
    if (!latestFabric) {
      throw new Error(`No se encontró versión estable de Fabric para Minecraft ${version}`);
    }
    
    // En realidad, para Fabric necesitamos usar el installer
    // Esto es un ejemplo simplificado
    // Para implementación real, necesitaríamos usar el installer de Fabric
    
    // Por ahora, solo descargamos el client.jar base
    await minecraftDownloadService.downloadClientJar(version, instancePath);
    
    // TODO: Implementar lógica completa para descargar e instalar Fabric loader
    console.log(`Fabric loader para ${version} descarga pendiente de implementación completa`);
  }
  
  /**
   * Descarga el loader de Forge
   */
  private async downloadForgeLoader(version: string, instancePath: string): Promise<void> {
    // Obtener información de Forge para la versión específica
    // URL de ejemplo: https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.2.20/forge-1.20.1-47.2.20-installer.jar
    // TODO: Implementar lógica completa para descargar e instalar Forge
    
    // Por ahora, solo descargamos el client.jar base
    await minecraftDownloadService.downloadClientJar(version, instancePath);
    
    console.log(`Forge loader para ${version} descarga pendiente de implementación completa`);
  }
  
  /**
   * Descarga el loader de Quilt
   */
  private async downloadQuiltLoader(version: string, instancePath: string): Promise<void> {
    // TODO: Implementar lógica completa para descargar e instalar Quilt
    
    // Por ahora, solo descargamos el client.jar base
    await minecraftDownloadService.downloadClientJar(version, instancePath);
    
    console.log(`Quilt loader para ${version} descarga pendiente de implementación completa`);
  }
  
  /**
   * Instala contenido adicional (mods, resourcepacks, etc.) en una instancia existente
   */
  async installContentToInstance(
    instancePath: string,
    contentId: string, 
    contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'modpack',
    mcVersion: string,
    loader?: string
  ): Promise<void> {
    if (!fs.existsSync(instancePath)) {
      throw new Error(`La instancia no existe: ${instancePath}`);
    }
    
    try {
      if (contentType === 'modpack') {
        // Instalar modpack
        await modrinthDownloadService.downloadModpack(contentId, instancePath, mcVersion, loader);
      } else {
        // Instalar contenido individual
        await modrinthDownloadService.downloadContent(contentId, instancePath, mcVersion, loader, contentType);
      }
      
      console.log(`Contenido ${contentType} ${contentId} instalado en ${instancePath}`);
    } catch (error) {
      console.error(`Error al instalar ${contentType} ${contentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Verifica si una instancia está completamente lista para ejecutarse
   */
  isInstanceComplete(instancePath: string): boolean {
    // Verificar que exista el archivo client.jar
    const clientJarPath = path.join(instancePath, 'client.jar');
    if (!fs.existsSync(clientJarPath)) {
      return false;
    }
    
    // Verificar que exista la estructura de carpetas básica
    const requiredFolders = ['mods', 'config', 'saves', 'logs'];
    for (const folder of requiredFolders) {
      const folderPath = path.join(instancePath, folder);
      if (!fs.existsSync(folderPath)) {
        return false;
      }
    }
    
    return true;
  }
}

export const instanceCreationService = new InstanceCreationService();