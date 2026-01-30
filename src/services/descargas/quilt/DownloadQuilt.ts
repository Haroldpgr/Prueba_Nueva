// src/services/descargas/quilt/DownloadQuilt.ts
// Lógica CORRECTA para instalar Quilt Loader
// API oficial: https://meta.quiltmc.org/v3/versions/loader/<mcVersion>
// Basado en: https://minecraft-launcher-lib.readthedocs.io/

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { getLauncherDataPath } from '../../../utils/paths';
import { logProgressService } from '../../logProgressService';
import { downloadVanilla } from '../vanilla/DownloadVanilla';

/**
 * Servicio para instalar Quilt Loader
 * 
 * IMPORTANTE: Quilt requiere vanilla primero, luego instala el loader sobre él.
 * Similar a Fabric pero con API diferente (v3).
 * 
 * Flujo correcto:
 * 1. Descargar vanilla completo (client.jar, version.json, libraries, assets)
 * 2. Descargar Quilt Loader desde meta.quiltmc.org
 * 3. Descargar dependencias del loader
 * 4. Generar version.json de Quilt que hereda de vanilla
 */
export class DownloadQuilt {
  private launcherDir: string;
  private versionsPath: string;
  private librariesPath: string;

  constructor() {
    this.launcherDir = getLauncherDataPath();
    this.versionsPath = path.join(this.launcherDir, 'versions');
    this.librariesPath = path.join(this.launcherDir, 'libraries');
    this.ensureDir(this.versionsPath);
    this.ensureDir(this.librariesPath);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Descarga una instancia Quilt completa
   * 
   * IMPORTANTE: Primero descarga vanilla, luego instala Quilt sobre él.
   * Quilt NO funciona sin vanilla base.
   * 
   * @param mcVersion Versión de Minecraft (ej. '1.21.11')
   * @param loaderVersion Versión de Quilt Loader (ej. '0.27.0') o undefined para última estable
   * @param instancePath Ruta donde se creará la instancia
   */
  async downloadInstance(
    mcVersion: string,
    loaderVersion: string | undefined,
    instancePath: string
  ): Promise<void> {
    try {
      logProgressService.info(`[Quilt] Iniciando instalación de Quilt para Minecraft ${mcVersion}...`);

      // PASO 1: Descargar vanilla completo primero (Quilt necesita vanilla base)
      logProgressService.info(`[Quilt] Descargando vanilla base...`);
      await downloadVanilla.downloadInstance(mcVersion, instancePath);

      // PASO 2: Obtener versión de Quilt Loader
      let quiltLoaderVersion = loaderVersion;
      if (!quiltLoaderVersion) {
        quiltLoaderVersion = await this.getLatestQuiltLoaderVersion(mcVersion);
      }

      logProgressService.info(`[Quilt] Usando Quilt Loader ${quiltLoaderVersion}`);

      // PASO 3: Descargar Quilt Loader y sus dependencias
      await this.downloadQuiltLoader(mcVersion, quiltLoaderVersion);

      // PASO 4: Generar version.json de Quilt
      await this.generateQuiltVersionJson(mcVersion, quiltLoaderVersion);

      logProgressService.info(`[Quilt] Instalación completada exitosamente`);
    } catch (error) {
      logProgressService.error(`[Quilt] Error al instalar:`, error);
      throw error;
    }
  }

  /**
   * Obtiene la última versión de Quilt Loader para una versión de MC
   */
  private async getLatestQuiltLoaderVersion(mcVersion: string): Promise<string> {
    const apiUrl = `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`;
    
    logProgressService.info(`[Quilt] Consultando API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'DRK-Launcher/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Error al consultar API de Quilt: HTTP ${response.status}`);
    }

    const versions = await response.json();
    
    // Quilt API v3 devuelve array de objetos con estructura diferente a Fabric
    // Buscar la primera versión disponible (más reciente)
    if (versions.length > 0 && versions[0].loader?.version) {
      return versions[0].loader.version;
    }

    throw new Error(`No se encontró versión de Quilt Loader para Minecraft ${mcVersion}`);
  }

  /**
   * Descarga Quilt Loader y sus dependencias
   */
  private async downloadQuiltLoader(mcVersion: string, loaderVersion: string): Promise<void> {
    const apiUrl = `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
    
    logProgressService.info(`[Quilt] Descargando perfil de Quilt desde: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'DRK-Launcher/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Error al obtener perfil de Quilt: HTTP ${response.status}`);
    }

    const profile = await response.json();
    
    // Descargar librerías del perfil con descargas paralelas (hasta 75 simultáneas)
    if (profile.libraries && Array.isArray(profile.libraries)) {
      logProgressService.info(`[Quilt] Descargando ${profile.libraries.length} librerías en paralelo (hasta 75 simultáneas)...`);
      
      const maxConcurrent = 75;
      let downloaded = 0;
      const total = profile.libraries.length;
      
      // Procesar en lotes de hasta 75 descargas simultáneas
      for (let i = 0; i < profile.libraries.length; i += maxConcurrent) {
        const batch = profile.libraries.slice(i, i + maxConcurrent);
        
        const results = await Promise.allSettled(
          batch.map(async (lib: any) => {
            try {
              await this.downloadLibrary(lib);
              downloaded++;
              
              // Log de progreso cada 10 descargas
              if (downloaded % 10 === 0) {
                const progress = Math.round((downloaded / total) * 100);
                logProgressService.info(`[Quilt] Progreso librerías: ${downloaded}/${total} (${progress}%)`);
              }
            } catch (error) {
              logProgressService.warning(`[Quilt] Error al descargar librería:`, error);
              throw error;
            }
          })
        );
        
        const successes = results.filter(r => r.status === 'fulfilled').length;
        const errors = results.filter(r => r.status === 'rejected').length;
        
        if (errors > 0) {
          logProgressService.warning(`[Quilt] ${errors} librerías fallaron en este lote (continuando...)`);
        }
        
        // Pequeña pausa entre lotes
        if (i + maxConcurrent < profile.libraries.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      logProgressService.success(`[Quilt] Librerías descargadas: ${downloaded}/${total}`);
    }
  }

  /**
   * Descarga una librería individual
   */
  private async downloadLibrary(lib: any): Promise<void> {
    if (!lib.name) {
      logProgressService.warning(`[Quilt] Librería sin nombre, omitiendo`);
      return;
    }

    // Verificar reglas de compatibilidad PRIMERO
    if (lib.rules && !this.isLibraryAllowed(lib.rules)) {
      logProgressService.info(`[Quilt] Librería excluida por reglas: ${lib.name}`);
      return;
    }

    // Construir path desde el nombre Maven
    const libPath = lib.downloads?.artifact?.path
      ? path.join(this.librariesPath, lib.downloads.artifact.path)
      : path.join(this.librariesPath, this.getLibraryPath(lib.name));

    if (fs.existsSync(libPath)) {
      logProgressService.info(`[Quilt] Librería ya existe: ${path.basename(libPath)}`);
      return; // Ya existe
    }

    try {
      this.ensureDir(path.dirname(libPath));

      // Determinar URL de descarga
      let downloadUrl: string | null = null;

      // Prioridad 1: URL desde downloads.artifact.url
      if (lib.downloads?.artifact?.url) {
        downloadUrl = lib.downloads.artifact.url;
      }
      // Prioridad 2: Construir URL desde el nombre Maven para org.quiltmc.*
      else if (lib.name.startsWith('org.quiltmc:')) {
        downloadUrl = this.buildQuiltMavenUrl(lib.name);
      }
      // Prioridad 3: Maven Central para otras librerías
      else if (lib.name.includes(':')) {
        downloadUrl = this.buildMavenUrl(lib.name);
      }

      if (!downloadUrl) {
        logProgressService.warning(`[Quilt] No se pudo construir URL para librería: ${lib.name}`);
        return;
      }

      logProgressService.info(`[Quilt] Descargando librería: ${lib.name} -> ${path.basename(libPath)}`);

      const response = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'DRK-Launcher/1.0' }
      });

      if (!response.ok) {
        // Si falla con Maven Central y es org.quiltmc.*, intentar con repositorio de Quilt
        if (downloadUrl.includes('repo1.maven.org') && lib.name.startsWith('org.quiltmc:')) {
          const quiltUrl = this.buildQuiltMavenUrl(lib.name);
          if (quiltUrl !== downloadUrl) {
            logProgressService.info(`[Quilt] Reintentando desde repositorio de Quilt...`);
            const fallbackResponse = await fetch(quiltUrl, {
              headers: { 'User-Agent': 'DRK-Launcher/1.0' }
            });
            if (fallbackResponse.ok) {
              const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
              fs.writeFileSync(libPath, buffer);
              logProgressService.info(`[Quilt] ✓ Librería descargada desde repositorio de Quilt: ${path.basename(libPath)} (${(buffer.length / 1024).toFixed(2)} KB)`);
              return;
            }
          }
        }
        throw new Error(`Error al descargar ${lib.name}: HTTP ${response.status} (URL: ${downloadUrl})`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(libPath, buffer);

      logProgressService.info(`[Quilt] ✓ Librería descargada: ${path.basename(libPath)} (${(buffer.length / 1024).toFixed(2)} KB)`);
    } catch (error) {
      logProgressService.warning(`[Quilt] Error al descargar librería ${lib.name}:`, error);
      // No lanzar error, continuar con otras librerías
    }
  }

  /**
   * Genera el version.json de Quilt
   */
  private async generateQuiltVersionJson(mcVersion: string, loaderVersion: string): Promise<void> {
    const apiUrl = `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
    
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'DRK-Launcher/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Error al obtener perfil de Quilt: HTTP ${response.status}`);
    }

    const quiltProfile = await response.json();
    
    // El perfil de Quilt ya viene con toda la información necesaria
    // Solo necesitamos guardarlo en el lugar correcto
    const versionName = `quilt-loader-${loaderVersion}-${mcVersion}`;
    const versionDir = path.join(this.versionsPath, versionName);
    this.ensureDir(versionDir);
    
    const versionJsonPath = path.join(versionDir, `${versionName}.json`);
    
    // Asegurar que el profile tenga el ID correcto
    const profileToSave = {
      ...quiltProfile,
      id: versionName
    };
    
    fs.writeFileSync(versionJsonPath, JSON.stringify(profileToSave, null, 2));
    
    logProgressService.info(`[Quilt] Version.json generado: ${versionName}`);
  }

  /**
   * Verifica si una librería está permitida según las reglas
   */
  private isLibraryAllowed(rules: any[]): boolean {
    if (!rules || rules.length === 0) {
      return true;
    }

    let allowed = false;
    const currentOs = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';

    for (const rule of rules) {
      const osName = rule.os?.name;
      const action = rule.action;

      if (osName) {
        if (osName === currentOs) {
          allowed = action === 'allow';
        }
      } else if (action === 'allow') {
        allowed = true;
      } else if (action === 'disallow') {
        allowed = false;
      }
    }

    return allowed;
  }

  /**
   * Convierte el nombre de la librería al formato de ruta
   */
  private getLibraryPath(libraryName: string): string {
    const parts = libraryName.split(':');
    if (parts.length < 3) {
      throw new Error(`Formato de librería inválido: ${libraryName}`);
    }

    const [group, artifact, version] = parts;
    const groupPath = group.replace(/\./g, '/');
    const fileName = `${artifact}-${version}.jar`;

    return path.join(groupPath, artifact, version, fileName);
  }

  /**
   * Construye la URL de Maven Central para una librería
   */
  private buildMavenUrl(libraryName: string): string {
    const parts = libraryName.split(':');
    if (parts.length < 3) {
      return '';
    }

    const [group, artifact, version] = parts;
    const groupPath = group.replace(/\./g, '/');

    return `https://repo1.maven.org/maven2/${groupPath}/${artifact}/${version}/${artifact}-${version}.jar`;
  }

  /**
   * Construye la URL del repositorio de Quilt para una librería
   * IMPORTANTE: Las librerías de Quilt (org.quiltmc.*) están en maven.quiltmc.org
   */
  private buildQuiltMavenUrl(libraryName: string): string {
    const parts = libraryName.split(':');
    if (parts.length < 3) {
      return '';
    }

    const [group, artifact, version] = parts;
    const groupPath = group.replace(/\./g, '/');

    return `https://maven.quiltmc.org/repository/release/${groupPath}/${artifact}/${version}/${artifact}-${version}.jar`;
  }
}

// Exportar solo la instancia (patrón singleton)
export const downloadQuilt = new DownloadQuilt();

