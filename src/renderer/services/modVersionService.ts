// src/renderer/services/modVersionService.ts

import { ModrinthVersion } from '../../services/modDownloadService';

export interface ModVersionSelection {
  projectId: string;
  mcVersion: string;
  loader?: string;
  availableVersions: ModrinthVersion[];
  compatibleVersions: ModrinthVersion[];
  selectedVersionId: string | null;
}

export interface ContentInstallOptions {
  projectId: string;
  instancePath: string;
  mcVersion: string;
  contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack';
  loader?: string;  // Solo para mods que requieren loader
  versionId?: string;  // Para todos los tipos de contenido
  selectedLoader?: string;  // Loader seleccionado explícitamente por el usuario
}

export class ModVersionService {
  /**
   * Obtiene todas las versiones disponibles de un mod
   */
  async getModVersions(projectId: string): Promise<ModrinthVersion[]> {
    try {
      const versions = await window.api.modrinth.getVersions(projectId);
      return versions;
    } catch (error) {
      console.error(`Error al obtener versiones del mod ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene versiones compatibles de un mod
   */
  async getCompatibleVersions(
    projectId: string, 
    mcVersion: string, 
    loader?: string
  ): Promise<ModrinthVersion[]> {
    try {
      const result = await window.api.modrinth.getCompatibleVersions({
        projectId,
        mcVersion,
        loader
      });
      return result;
    } catch (error) {
      console.error(`Error al obtener versiones compatibles del mod ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Selecciona una versión específica de un mod
   */
  selectVersion(
    projectId: string,
    mcVersion: string,
    loader: string | undefined,
    versionId: string
  ): ModVersionSelection {
    return {
      projectId,
      mcVersion,
      loader,
      availableVersions: [],
      compatibleVersions: [],
      selectedVersionId: versionId
    };
  }

  /**
   * Obtiene loaders disponibles para un proyecto específico
   */
  async getProjectLoaders(projectId: string): Promise<string[]> {
    try {
      const versions = await this.getModVersions(projectId);
      // Obtener todos los loaders únicos de todas las versiones
      const allLoaders = versions.flatMap(version => version.loaders);
      // Devolver solo loaders únicos
      return [...new Set(allLoaders)];
    } catch (error) {
      console.error(`Error al obtener loaders del proyecto ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Verifica si un tipo de contenido requiere loader
   */
  contentTypeRequiresLoader(contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack'): boolean {
    return contentType === 'mod'; // Solo los mods requieren loader
  }

  /**
   * Obtiene loaders compatibles con una versión de Minecraft específica
   */
  async getCompatibleLoadersForMinecraft(
    projectId: string,
    mcVersion: string
  ): Promise<string[]> {
    try {
      const versions = await this.getModVersions(projectId);
      // Filtrar versiones que coincidan con la versión de Minecraft
      const matchingVersions = versions.filter(version =>
        version.game_versions.includes(mcVersion)
      );

      // Obtener loaders de esas versiones
      const loaders = matchingVersions.flatMap(version => version.loaders);
      // Devolver solo loaders únicos
      return [...new Set(loaders)];
    } catch (error) {
      console.error(`Error al obtener loaders compatibles para ${projectId} y ${mcVersion}:`, error);
      return [];
    }
  }

  /**
   * Instala un contenido con la versión y loader seleccionados
   */
  async installContentWithOptions(options: ContentInstallOptions): Promise<void> {
    try {
      // Para mods, validar que se proporcionó un loader (o determinarlo automáticamente)
      if (options.contentType === 'mod' && !options.loader && !options.selectedLoader) {
        console.warn(`Advertencia: Se está instalando un mod (${options.projectId}) sin loader especificado`);
      }

      // Si hay un loader seleccionado explícitamente que difiere del loader del entorno,
      // usar el loader seleccionado en lugar del del entorno
      const effectiveLoader = options.selectedLoader || options.loader;

      await window.api.instance.installContent({
        instancePath: options.instancePath,
        contentId: options.projectId,
        contentType: options.contentType,
        mcVersion: options.mcVersion,
        loader: effectiveLoader,
        versionId: options.versionId
      });
    } catch (error) {
      console.error(`Error al instalar el contenido ${options.projectId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene opciones de instalación sugeridas para un proyecto
   */
  async getSuggestedInstallOptions(
    projectId: string,
    mcVersion: string,
    instanceLoader?: string
  ): Promise<ContentInstallOptions> {
    const versions = await this.getModVersions(projectId);

    // Determinar el tipo de contenido basado en las categorías del proyecto
    // Esto es una simplificación - en la práctica podría necesitar más lógica
    const firstVersion = versions[0];
    let contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack' = 'mod';

    if (firstVersion) {
      // Determinar tipo de contenido basado en categorías o tags del proyecto
      // Por ejemplo, si tiene categorías relacionadas con shaders
      const categories = firstVersion.files.flatMap(file => file.filename.includes('.zip') ? ['resourcepack'] : []).concat(firstVersion.loaders);

      if (categories.some(cat => ['shader', 'shaders'].includes(cat))) {
        contentType = 'shader';
      } else if (categories.some(cat => ['resourcepack', 'texture', 'texture_pack'].includes(cat))) {
        contentType = 'resourcepack';
      } else if (categories.some(cat => ['datapack', 'data_pack'].includes(cat))) {
        contentType = 'datapack';
      } else if (categories.some(cat => ['forge', 'fabric', 'quilt', 'neoforge'].includes(cat))) {
        contentType = 'mod';
      }
    }

    return {
      projectId,
      instancePath: '', // Debe ser proporcionado por el llamador
      mcVersion,
      contentType,
      loader: instanceLoader,
      versionId: undefined,
      selectedLoader: undefined
    };
  }
}

export const modVersionService = new ModVersionService();