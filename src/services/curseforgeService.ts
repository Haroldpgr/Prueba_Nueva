import fetch from 'node-fetch';

// API Key provided by the user
const CURSEFORGE_API_KEY = '$2a$10$8qrneNohy/pV0jJKZVbUuu.kXuDwlRmfhnf4o.7VGEN/bEjXTOPWC';
const CURSEFORGE_API_URL = 'https://api.curseforge.com/v1';

// Define types for CurseForge content
interface CurseForgeMod {
  id: number;
  name: string;
  summary: string;
  authors: { name: string }[];
  downloadCount: number;
  dateModified: string;
  gameVersionLatestFiles: { gameVersion: string }[];
  categories: { name: string }[];
  logo: { thumbnailUrl: string };
  links: { websiteUrl: string };
  latestFiles: { fileName: string; downloadUrl?: string }[];
}

interface CurseForgeSearchResponse {
  data: {
    data: CurseForgeMod[];
  };
}

// Map our content types to CurseForge category IDs
const curseForgeCategoryIds: { [key: string]: number } = {
  modpacks: 4471,  // Modpacks
  mods: 6,          // Minecraft Mods
  resourcepacks: 12, // Resource Packs
  datapacks: 5269,   // Data Packs
  shaders: 6552      // Shaders
};

// Map our content types to their display names
const contentTypeNames: { [key: string]: string } = {
  modpacks: 'Modpacks',
  mods: 'Mods',
  resourcepacks: 'Resource Packs',
  datapacks: 'Data Packs',
  shaders: 'Shaders'
};

export class CurseForgeService {
  private headers = {
    'X-API-Key': CURSEFORGE_API_KEY,
    'Content-Type': 'application/json',
    'User-Agent': 'DRK-Launcher/1.0 (contacto@drklauncher.com)'
  };

  async searchContent(contentType: string, search: string = ''): Promise<any[]> {
    try {
      // Get the category ID for the content type
      const categoryId = curseForgeCategoryIds[contentType];
      if (!categoryId) {
        console.error('Invalid content type for CurseForge:', contentType);
        return [];
      }

      // Fetch multiple pages concurrently to get more results (up to 2000 total) with reliable page size
      const PAGE_SIZE = 50; // Use page size that works reliably with CurseForge API
      const maxResults = 2000; // Maximum results to fetch

      // Calculate how many requests we'll need
      const numRequests = Math.min(40, Math.ceil(maxResults / PAGE_SIZE)); // Maximum of 40 requests for 2000 results

      // Create all request promises
      const requests = [];
      for (let i = 0; i < numRequests; i++) {
        const index = i * PAGE_SIZE;
        const params = new URLSearchParams({
          gameId: '432', // Minecraft game ID for CurseForge API
          classId: categoryId.toString(),
          searchFilter: search || '',
          sortField: search ? '2' : '3', // Sort by relevance if searching, otherwise by download count
          sortOrder: 'desc', // Descending order as string
          index: index.toString(),
          pageSize: PAGE_SIZE.toString()
        });

        const url = `${CURSEFORGE_API_URL}/mods/search?${params}`;
        console.log(`Preparando solicitud CurseForge ${i + 1}:`, url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        requests.push(
          fetch(url, {
            method: 'GET',
            headers: this.headers,
            signal: controller.signal
          })
        );
      }

      // Execute all requests concurrently
      const responses = await Promise.all(requests);

      // Process all responses
      const allResults: any[] = [];
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`Error fetching from CurseForge (request ${i + 1}): ${response.status} ${response.statusText}`, errorBody);
          continue; // Continue with other responses
        }

        const json: any = await response.json();
        console.log(`Respuesta de CurseForge solicitud ${i + 1}:`, json);

        // Process the response
        let pageItems: any[] = [];
        if (json && json.data && Array.isArray(json.data)) {
          pageItems = json.data;
        } else if (json && json.data && json.data.data && Array.isArray(json.data.data)) {
          pageItems = json.data.data;
        } else if (Array.isArray(json)) {
          pageItems = json;
        }

        if (pageItems.length === 0) {
          break; // No more results
        }

        allResults.push(...pageItems);

        if (pageItems.length < PAGE_SIZE) {
          break; // Last page
        }
      }

      // Limit to maxResults if needed
      const finalResults = allResults.slice(0, maxResults);

      return finalResults.map(item => ({
        id: item.id ? item.id.toString() : Math.random().toString(36).substr(2, 9), // Convert to string to match our existing format
        title: item.name || item.title || 'Unknown Title',
        description: item.summary || item.description || 'No description available',
        author: (item.authors && item.authors.length > 0) ? item.authors[0].name : item.author || 'Unknown',
        downloads: item.downloadCount || item.downloads || 0,
        lastUpdated: item.dateModified || item.lastUpdated || new Date().toISOString(),
        minecraftVersions: (item.gameVersionLatestFiles ? item.gameVersionLatestFiles.map((f: any) => f.gameVersion) :
                          item.gameVersions ? item.gameVersions : []),
        categories: (item.categories ? item.categories.map((c: any) => c.name) :
                    item.categorySection?.name ? [item.categorySection.name] : []),
        imageUrl: this.getBestImageUrl(item), // Use a dedicated method to get the best image
        type: contentType as 'modpacks' | 'mods' | 'resourcepacks' | 'datapacks' | 'shaders',
        version: (item.latestFiles && item.latestFiles.length > 0) ? item.latestFiles[0].fileName || item.version :
                  item.file?.fileName || item.version || 'N/A',
        downloadUrl: (item.latestFiles && item.latestFiles.length > 0) ? item.latestFiles[0].downloadUrl :
                   item.downloadUrl || undefined
      }));
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('CurseForge request timed out:', error);
        throw new Error('CurseForge request timed out');
      }
      console.error('Error fetching content from CurseForge:', error);
      return []; // Return empty array in case of error
    }
  }

  // Method to get the best available image URL
  private getBestImageUrl(item: any): string {
    // Check multiple possible image properties in order of preference
    const imageUrl =
      item.logo?.url ||
      item.logo?.thumbnailUrl ||
      item.logo?.imageUrl ||
      item.primaryScreenshot?.url ||
      (item.screenshots && item.screenshots.length > 0 ? item.screenshots[0]?.url : null) ||
      item.thumbnailUrl ||
      item.thumbnail?.url ||
      item.imageUrl ||
      null;

    return imageUrl;
  }

  // Get compatible versions for a specific project
  // Retorna estructura similar a Modrinth para compatibilidad
  // NO filtra por mcVersion ni loader - devuelve TODAS las versiones disponibles
  // El filtrado lo hace ContentPage igual que con Modrinth
  async getCompatibleVersions(projectId: string, mcVersion: string, loader?: string) {
    try {
      const response = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Error fetching files for project ${projectId}: ${response.statusText}`);
      }

      const data = await response.json();

      // Procesar la respuesta para extraer información de compatibilidad
      // Retornar estructura similar a Modrinth: objetos con game_versions (array) y loaders (array)
      // NO filtrar aquí - devolver TODAS las versiones y loaders disponibles
      if (data && data.data && Array.isArray(data.data)) {
        const compatibilityInfo: any[] = [];

        console.log(`CurseForge: Procesando ${data.data.length} archivos...`);
        
        data.data.forEach((file: any) => {
          if (!file.gameVersions || !Array.isArray(file.gameVersions)) {
            return;
          }

          // Extraer información del modloader desde gameVersionTypeIds (más confiable)
          let extractedModLoader: string | null = null;
          
          if (file.gameVersionTypeIds && Array.isArray(file.gameVersionTypeIds) && file.gameVersionTypeIds.length > 0) {
            const loaderTypeMap: Record<number, string> = {
              1: 'forge',
              4: 'fabric',
              5: 'quilt',
              6: 'neoforge'
            };
            
            for (const typeId of file.gameVersionTypeIds) {
              if (loaderTypeMap[typeId]) {
                extractedModLoader = loaderTypeMap[typeId];
                break;
              }
            }
          }
          
          // Si no se encontró en gameVersionTypeIds, intentar otras propiedades
          if (!extractedModLoader) {
            if (file.modLoader) {
              const loaderLower = file.modLoader.toLowerCase();
              if (loaderLower.includes('forge') && !loaderLower.includes('neo')) {
                extractedModLoader = 'forge';
              } else if (loaderLower.includes('fabric')) {
                extractedModLoader = 'fabric';
              } else if (loaderLower.includes('quilt')) {
                extractedModLoader = 'quilt';
              } else if (loaderLower.includes('neoforge') || loaderLower.includes('neo-forge')) {
                extractedModLoader = 'neoforge';
              }
            }
          }

          // Extraer versiones de juego del array gameVersions
          const gameVersionList: string[] = [];
          file.gameVersions.forEach((versionOrLoader: string) => {
            // Si es una versión de Minecraft (empieza con "1.")
            if (typeof versionOrLoader === 'string' && versionOrLoader.startsWith('1.')) {
              gameVersionList.push(versionOrLoader);
            }
            // Si es un loader en el array (puede estar mezclado)
            else if (typeof versionOrLoader === 'string') {
              const lower = versionOrLoader.toLowerCase();
              if (lower.includes('forge') && !lower.includes('neo') && !extractedModLoader) {
                extractedModLoader = 'forge';
              } else if (lower.includes('fabric') && !extractedModLoader) {
                extractedModLoader = 'fabric';
              } else if (lower.includes('quilt') && !extractedModLoader) {
                extractedModLoader = 'quilt';
              } else if ((lower.includes('neoforge') || lower.includes('neo-forge')) && !extractedModLoader) {
                extractedModLoader = 'neoforge';
              }
            }
          });

          // Si no hay loader extraído, intentar usar el loader por defecto o saltar este archivo
          if (!extractedModLoader) {
            // Algunos archivos pueden no tener loader explícito, pero podemos intentar inferirlo
            // Por ahora, saltamos estos archivos para evitar datos incorrectos
            return;
          }

          // Obtener información del archivo una vez (fuera del loop de versiones)
          const fileId = file.id;
          const fileName = file.fileName || file.displayName || `curseforge-${projectId}.jar`;
          let fileDownloadUrl = file.downloadUrl;
          
          // Si no hay downloadUrl pero hay fileId, construirla
          if (!fileDownloadUrl && fileId) {
            fileDownloadUrl = `https://edge.forgecdn.net/files/${Math.floor(fileId / 1000)}/${fileId % 1000}/${fileName}`;
          }
          
          // Procesar cada versión de juego encontrada - NO FILTRAR AQUÍ
          // Devolver TODAS las versiones y loaders disponibles
          gameVersionList.forEach((version: string) => {
            // Solo incluir versiones válidas de Minecraft (empiezan con "1.")
            if (version.startsWith('1.')) {
              // Crear un objeto por cada combinación versión-loader, igual que Modrinth
              // SIEMPRE incluir fileId y downloadUrl para que estén disponibles
              compatibilityInfo.push({
                game_versions: [version], // Array como Modrinth
                loaders: [extractedModLoader!], // Array como Modrinth
                gameVersion: version, // Mantener para compatibilidad
                modLoader: extractedModLoader!, // Mantener para compatibilidad
                downloadUrl: fileDownloadUrl || null, // URL de descarga (siempre intentar incluir)
                fileId: fileId || null, // ID del archivo (SIEMPRE incluir si está disponible)
                fileName: fileName || null // Nombre del archivo
              });
            }
          });
        });

        // Ordenar por versión de juego (más reciente primero) - simular comportamiento de Modrinth
        return compatibilityInfo.sort((a, b) => {
          const aParts = a.game_versions[0].split('.').map(Number);
          const bParts = b.game_versions[0].split('.').map(Number);
          for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
            if (aParts[i] !== bParts[i]) {
              return bParts[i] - aParts[i]; // Orden descendente
            }
          }
          return bParts.length - aParts.length;
        });
      }

      return [];
    } catch (error) {
      console.error(`Error getting compatible versions for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Descarga contenido de CurseForge a una instancia
   */
  async downloadContent(
    projectId: string,
    instancePath: string,
    mcVersion: string,
    loader?: string,
    contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack' = 'mod'
  ): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    const https = await import('https');
    const http = await import('http');

    try {
      // Obtener versiones compatibles (NO filtra por mcVersion/loader, devuelve todas)
      const compatibleVersions = await this.getCompatibleVersions(projectId, mcVersion, loader);
      
      console.log(`[downloadContent] Total versiones compatibles obtenidas: ${compatibleVersions.length}`);
      if (compatibleVersions.length > 0) {
        console.log(`[downloadContent] Primeras 3 versiones:`, compatibleVersions.slice(0, 3).map((v: any) => ({
          game_versions: v.game_versions,
          loaders: v.loaders,
          hasDownloadUrl: !!v.downloadUrl,
          hasFileId: !!v.fileId
        })));
      }
      
      if (compatibleVersions.length === 0) {
        throw new Error(`No se encontró una versión compatible para ${mcVersion} y ${loader || 'cualquier loader'}`);
      }

      // Filtrar versiones que coincidan exactamente con la versión y loader solicitados
      const matchingVersions = compatibleVersions.filter((v: any) => {
        const versionMatch = (v.game_versions && Array.isArray(v.game_versions) && v.game_versions.includes(mcVersion)) ||
                             (v.gameVersion === mcVersion);
        const loaderMatch = !loader || 
                            (v.loaders && Array.isArray(v.loaders) && v.loaders.includes(loader)) ||
                            (v.modLoader && v.modLoader.toLowerCase() === loader.toLowerCase());
        return versionMatch && loaderMatch;
      });
      
      console.log(`[downloadContent] Versiones que coinciden con ${mcVersion}${loader ? ` y ${loader}` : ''}: ${matchingVersions.length}`);
      
      if (matchingVersions.length === 0) {
        throw new Error(`No se encontró una versión compatible para ${mcVersion} y ${loader || 'cualquier loader'}`);
      }

      // Tomar la primera versión compatible (la más reciente)
      const targetVersion = matchingVersions[0];
      
      // Obtener URL de descarga
      let downloadUrl = targetVersion.downloadUrl;
      const fileId = targetVersion.fileId;
      const targetFileName = targetVersion.fileName || `curseforge-${projectId}.jar`;
      
      console.log(`[downloadContent] targetVersion completo:`, JSON.stringify(targetVersion, null, 2));
      
      // SIEMPRE intentar construir la URL si tenemos fileId, incluso si ya hay downloadUrl
      // (por si la URL directa no funciona)
      if (fileId) {
        const constructedUrl = `https://edge.forgecdn.net/files/${Math.floor(fileId / 1000)}/${fileId % 1000}/${targetFileName}`;
        if (!downloadUrl) {
          downloadUrl = constructedUrl;
          console.log(`[downloadContent] Construida URL de descarga desde fileId: ${downloadUrl}`);
        } else {
          console.log(`[downloadContent] URL de descarga disponible: ${downloadUrl}, también construida: ${constructedUrl}`);
        }
      }
      
      // Si no hay downloadUrl pero tenemos fileId, usar el endpoint oficial
      if (!downloadUrl && fileId) {
        // Usar el endpoint oficial de CurseForge para obtener la URL de descarga
        // Según la documentación: GET /v1/mods/{modId}/files/{fileId}/download-url
        try {
          console.log(`[downloadContent] Obteniendo URL de descarga oficial desde API para fileId ${fileId}...`);
          const downloadUrlResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files/${fileId}/download-url`, {
            headers: this.headers
          });
          
          if (downloadUrlResponse.ok) {
            const downloadUrlData = await downloadUrlResponse.json();
            if (downloadUrlData.data && typeof downloadUrlData.data === 'string') {
              downloadUrl = downloadUrlData.data;
              console.log(`[downloadContent] ✅ URL de descarga obtenida desde endpoint oficial: ${downloadUrl}`);
            } else {
              console.warn(`[downloadContent] ⚠️ Endpoint oficial no devolvió URL válida:`, downloadUrlData);
            }
          } else {
            const errorText = await downloadUrlResponse.text();
            console.warn(`[downloadContent] ⚠️ Endpoint oficial de download-url falló (${downloadUrlResponse.status}):`, errorText);
          }
        } catch (apiError) {
          console.error(`[downloadContent] ❌ Error al obtener URL de descarga desde API:`, apiError);
        }
      }
      
      // Si aún no hay downloadUrl pero tenemos fileId, intentar método alternativo
      if (!downloadUrl && fileId) {
        try {
          console.log(`[downloadContent] Intentando método alternativo: obtener información del archivo ${fileId}...`);
          const fileResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files/${fileId}`, {
            headers: this.headers
          });
          
          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            if (fileData.data && fileData.data.downloadUrl) {
              downloadUrl = fileData.data.downloadUrl;
              console.log(`[downloadContent] ✅ URL de descarga obtenida desde información del archivo: ${downloadUrl}`);
            } else if (fileData.data && fileData.data.id) {
              // Construir URL usando el ID del archivo como último recurso
              const apiFileId = fileData.data.id;
              const apiFileName = fileData.data.fileName || fileData.data.displayName || targetFileName;
              downloadUrl = `https://edge.forgecdn.net/files/${Math.floor(apiFileId / 1000)}/${apiFileId % 1000}/${apiFileName}`;
              console.log(`[downloadContent] ✅ URL de descarga construida desde API fileId: ${downloadUrl}`);
            }
          }
        } catch (fileError) {
          console.error(`[downloadContent] ❌ Error al obtener información del archivo:`, fileError);
        }
      }
      
      if (!downloadUrl) {
        // Si aún no hay URL, intentar obtener todos los archivos y buscar uno compatible
        try {
          console.log(`[downloadContent] Obteniendo todos los archivos del proyecto para buscar uno compatible...`);
          const allFilesResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files`, {
            headers: this.headers
          });
          
          if (allFilesResponse.ok) {
            const allFilesData = await allFilesResponse.json();
            if (allFilesData.data && Array.isArray(allFilesData.data)) {
              // Buscar un archivo que coincida con la versión y loader
              const matchingFile = allFilesData.data.find((f: any) => {
                const hasVersion = f.gameVersions && Array.isArray(f.gameVersions) && 
                                  f.gameVersions.some((v: string) => v === mcVersion || v.startsWith(mcVersion));
                const hasLoader = !loader || (f.gameVersionTypeIds && Array.isArray(f.gameVersionTypeIds));
                return hasVersion && hasLoader;
              });
              
              if (matchingFile) {
                downloadUrl = matchingFile.downloadUrl;
                if (!downloadUrl && matchingFile.id) {
                  // Intentar usar el endpoint oficial de download-url según la documentación
                  // GET /v1/mods/{modId}/files/{fileId}/download-url
                  try {
                    console.log(`[downloadContent] Obteniendo URL de descarga oficial para archivo compatible ${matchingFile.id}...`);
                    const downloadUrlResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files/${matchingFile.id}/download-url`, {
                      headers: this.headers
                    });
                    
                    if (downloadUrlResponse.ok) {
                      const downloadUrlData = await downloadUrlResponse.json();
                      if (downloadUrlData.data && typeof downloadUrlData.data === 'string') {
                        downloadUrl = downloadUrlData.data;
                        console.log(`[downloadContent] URL de descarga obtenida desde endpoint oficial: ${downloadUrl}`);
                      }
                    }
                  } catch (downloadUrlError) {
                    console.warn(`[downloadContent] Error al obtener URL oficial, usando método alternativo:`, downloadUrlError);
                  }
                  
                  // Si aún no hay URL, construirla manualmente como último recurso
                  if (!downloadUrl) {
                    const matchFileId = matchingFile.id;
                    const matchFileName = matchingFile.fileName || matchingFile.displayName || targetFileName;
                    downloadUrl = `https://edge.forgecdn.net/files/${Math.floor(matchFileId / 1000)}/${matchFileId % 1000}/${matchFileName}`;
                    console.log(`[downloadContent] URL de descarga construida manualmente: ${downloadUrl}`);
                  }
                }
                console.log(`[downloadContent] URL de descarga encontrada en archivos: ${downloadUrl}`);
              }
            }
          }
        } catch (allFilesError) {
          console.error(`[downloadContent] Error al obtener todos los archivos:`, allFilesError);
        }
      }
      
      if (!downloadUrl) {
        // Último intento: obtener el archivo directamente desde la API usando el primer archivo disponible
        console.log(`[downloadContent] Intentando obtener archivo directamente desde la API...`);
        try {
          const directFilesResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files`, {
            headers: this.headers
          });
          
          if (directFilesResponse.ok) {
            const directFilesData = await directFilesResponse.json();
            if (directFilesData.data && Array.isArray(directFilesData.data) && directFilesData.data.length > 0) {
              // Buscar un archivo que tenga la versión y loader correctos
              for (const directFile of directFilesData.data) {
                const hasVersion = directFile.gameVersions && Array.isArray(directFile.gameVersions) && 
                                  directFile.gameVersions.some((v: string) => v === mcVersion || v.startsWith(mcVersion.split('.')[0] + '.' + mcVersion.split('.')[1]));
                
                if (hasVersion) {
                  // Verificar loader si se especificó
                  if (loader) {
                    const hasLoader = directFile.gameVersionTypeIds && Array.isArray(directFile.gameVersionTypeIds);
                    if (hasLoader) {
                      const loaderTypeMap: Record<number, string> = { 1: 'forge', 4: 'fabric', 5: 'quilt', 6: 'neoforge' };
                      const fileLoader = directFile.gameVersionTypeIds.find((id: number) => loaderTypeMap[id] === loader);
                      if (!fileLoader) continue;
                    } else {
                      continue;
                    }
                  }
                  
                  // Encontramos un archivo compatible
                  downloadUrl = directFile.downloadUrl;
                  if (!downloadUrl && directFile.id) {
                    const directFileId = directFile.id;
                    const directFileName = directFile.fileName || directFile.displayName || targetFileName;
                    downloadUrl = `https://edge.forgecdn.net/files/${Math.floor(directFileId / 1000)}/${directFileId % 1000}/${directFileName}`;
                  }
                  
                  if (downloadUrl) {
                    console.log(`[downloadContent] URL de descarga encontrada en búsqueda directa: ${downloadUrl}`);
                    break;
                  }
                }
              }
            }
          }
        } catch (directError) {
          console.error(`[downloadContent] Error en búsqueda directa:`, directError);
        }
      }
      
      if (!downloadUrl) {
        console.error(`[downloadContent] No se pudo obtener URL de descarga después de todos los intentos`);
        console.error(`[downloadContent] targetVersion completo:`, JSON.stringify(targetVersion, null, 2));
        throw new Error(`No se encontró URL de descarga para la versión compatible ${mcVersion}${loader ? ` y ${loader}` : ''}. Por favor, intenta con otra versión o loader.`);
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

      // Asegurar que el directorio existe
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Obtener nombre del archivo
      const finalFileName = targetVersion.fileName || targetFileName || `curseforge-${projectId}.jar`;
      const filePath = path.join(targetDir, finalFileName);

      // Si el archivo ya existe, generar nombre único
      let finalPath = filePath;
      if (fs.existsSync(filePath)) {
        const ext = path.extname(finalFileName);
        const nameWithoutExt = path.basename(finalFileName, ext);
        let counter = 1;
        let uniqueFileName;

        do {
          uniqueFileName = `${nameWithoutExt}_${counter}${ext}`;
          finalPath = path.join(targetDir, uniqueFileName);
          counter++;
        } while (fs.existsSync(finalPath));
      }

      // Descargar archivo
      await this.downloadFileToPath(downloadUrl, finalPath);
      console.log(`Descargado ${finalFileName} en ${targetDir}`);
    } catch (error) {
      console.error(`Error al descargar contenido ${contentType} ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Descarga e instala un modpack de CurseForge
   * @param projectId ID del proyecto en CurseForge
   * @param instancePath Ruta de la instancia donde instalar
   * @param mcVersion Versión de Minecraft objetivo
   * @param loader Tipo de mod loader (fabric, forge, etc.)
   */
  async downloadModpack(
    projectId: string,
    instancePath: string,
    mcVersion: string,
    loader?: string
  ): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    try {
      // Obtener versiones compatibles del modpack
      const compatibleVersions = await this.getCompatibleVersions(projectId, mcVersion, loader);
      
      if (compatibleVersions.length === 0) {
        throw new Error(`No se encontró una versión compatible del modpack para ${mcVersion} y ${loader || 'cualquier loader'}`);
      }

      // Filtrar versiones que coincidan exactamente
      const matchingVersions = compatibleVersions.filter((v: any) => {
        const versionMatch = (v.game_versions && Array.isArray(v.game_versions) && v.game_versions.includes(mcVersion)) ||
                             (v.gameVersion === mcVersion);
        const loaderMatch = !loader || 
                            (v.loaders && Array.isArray(v.loaders) && v.loaders.includes(loader)) ||
                            (v.modLoader && v.modLoader.toLowerCase() === loader.toLowerCase());
        return versionMatch && loaderMatch;
      });

      if (matchingVersions.length === 0) {
        throw new Error(`No se encontró una versión compatible del modpack para ${mcVersion} y ${loader || 'cualquier loader'}`);
      }

      const targetVersion = matchingVersions[0];
      let downloadUrl = targetVersion.downloadUrl;
      const fileId = targetVersion.fileId;
      const targetFileName = targetVersion.fileName || `curseforge-modpack-${projectId}.zip`;

      // Obtener URL de descarga si no está disponible
      if (!downloadUrl && fileId) {
        try {
          const downloadUrlResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files/${fileId}/download-url`, {
            headers: this.headers
          });
          
          if (downloadUrlResponse.ok) {
            const downloadUrlData = await downloadUrlResponse.json();
            if (downloadUrlData.data && typeof downloadUrlData.data === 'string') {
              downloadUrl = downloadUrlData.data;
            }
          }
        } catch (apiError) {
          console.error(`Error al obtener URL de descarga:`, apiError);
        }
      }

      if (!downloadUrl) {
        throw new Error(`No se encontró URL de descarga para el modpack ${projectId}`);
      }

      // Crear directorio temporal
      const tempDir = path.join(instancePath, '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Descargar el archivo ZIP del modpack
      const tempPackPath = path.join(tempDir, targetFileName);
      await this.downloadFileToPath(downloadUrl, tempPackPath);

      // Extraer el manifest.json del modpack
      const manifest = await this.extractCurseForgeModpackManifest(tempPackPath);

      // Procesar el manifest e instalar los componentes
      await this.processCurseForgeModpackManifest(manifest, instancePath, tempDir);

      // Limpiar archivos temporales
      if (fs.existsSync(tempPackPath)) {
        fs.unlinkSync(tempPackPath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }

      console.log(`Modpack de CurseForge ${projectId} instalado correctamente`);
    } catch (error) {
      console.error(`Error al instalar modpack de CurseForge ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Extrae el manifest.json de un modpack de CurseForge
   */
  private async extractCurseForgeModpackManifest(packPath: string): Promise<any> {
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
            // Buscar el archivo manifest.json
            const manifestEntry = Object.keys(zip.entries()).find(entry =>
              entry === 'manifest.json' || entry.endsWith('/manifest.json')
            );

            if (!manifestEntry) {
              reject(new Error('No se encontró el archivo manifest.json en el modpack de CurseForge'));
              zip.close();
              return;
            }

            zip.stream(manifestEntry, (err: Error | null, stm: any) => {
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
   * Procesa el manifest de un modpack de CurseForge e instala los componentes
   */
  private async processCurseForgeModpackManifest(manifest: any, instancePath: string, tempDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    if (!manifest.files || !Array.isArray(manifest.files)) {
      throw new Error('El manifest del modpack de CurseForge no tiene la estructura esperada');
    }

    // Crear directorios necesarios
    const modsDir = path.join(instancePath, 'mods');
    const resourcepacksDir = path.join(instancePath, 'resourcepacks');
    const shaderpacksDir = path.join(instancePath, 'shaderpacks');
    const configDir = path.join(instancePath, 'config');
    const datapacksDir = path.join(instancePath, 'datapacks');

    [modsDir, resourcepacksDir, shaderpacksDir, configDir, datapacksDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Procesar cada archivo del manifest
    for (const file of manifest.files) {
      const projectId = file.projectID;
      const fileId = file.fileID;
      const required = file.required !== false; // Por defecto son requeridos

      if (!projectId || !fileId) {
        console.warn(`Archivo en manifest sin projectID o fileID, saltando...`);
        continue;
      }

      try {
        // Obtener información del archivo desde la API de CurseForge
        const fileInfoResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files/${fileId}`, {
          headers: this.headers
        });

        if (!fileInfoResponse.ok) {
          console.warn(`No se pudo obtener información del archivo ${fileId} del proyecto ${projectId}`);
          if (required) {
            throw new Error(`Archivo requerido ${fileId} del proyecto ${projectId} no disponible`);
          }
          continue;
        }

        const fileInfoData = await fileInfoResponse.json();
        const fileInfo = fileInfoData.data;

        if (!fileInfo) {
          console.warn(`No se encontró información del archivo ${fileId}`);
          if (required) {
            throw new Error(`Archivo requerido ${fileId} no encontrado`);
          }
          continue;
        }

        // Obtener URL de descarga - intentar múltiples métodos
        let downloadUrl: string | null = null;
        
        // Método 1: Endpoint oficial de download-url
        try {
          const downloadUrlResponse = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files/${fileId}/download-url`, {
            headers: this.headers
          });

          if (downloadUrlResponse.ok) {
            const downloadUrlData = await downloadUrlResponse.json();
            downloadUrl = downloadUrlData.data;
            if (downloadUrl) {
              console.log(`[processCurseForgeModpackManifest] URL obtenida desde endpoint oficial para archivo ${fileId}`);
            }
          } else {
            const errorText = await downloadUrlResponse.text();
            console.warn(`[processCurseForgeModpackManifest] Endpoint oficial falló (${downloadUrlResponse.status}) para archivo ${fileId}:`, errorText);
          }
        } catch (apiError) {
          console.warn(`[processCurseForgeModpackManifest] Error al obtener URL desde endpoint oficial para archivo ${fileId}:`, apiError);
        }

        // Método 2: Construir URL manualmente si tenemos fileName
        if (!downloadUrl && fileInfo.fileName) {
          const constructedUrl = `https://edge.forgecdn.net/files/${Math.floor(fileId / 1000)}/${fileId % 1000}/${fileInfo.fileName}`;
          downloadUrl = constructedUrl;
          console.log(`[processCurseForgeModpackManifest] URL construida manualmente para archivo ${fileId}: ${constructedUrl}`);
        }

        // Método 3: Intentar con el nombre de archivo genérico si no tenemos fileName
        if (!downloadUrl) {
          const genericFileName = `curseforge-${projectId}-${fileId}.jar`;
          const constructedUrl = `https://edge.forgecdn.net/files/${Math.floor(fileId / 1000)}/${fileId % 1000}/${genericFileName}`;
          downloadUrl = constructedUrl;
          console.log(`[processCurseForgeModpackManifest] URL construida con nombre genérico para archivo ${fileId}: ${constructedUrl}`);
        }

        // Si aún no hay URL, intentar verificar si el archivo existe usando el endpoint de información
        if (!downloadUrl) {
          // Verificar si el archivo tiene downloadUrl en la información del archivo
          if (fileInfo.downloadUrl) {
            downloadUrl = fileInfo.downloadUrl;
            console.log(`[processCurseForgeModpackManifest] URL encontrada en fileInfo para archivo ${fileId}`);
          }
        }

        if (!downloadUrl) {
          console.error(`[processCurseForgeModpackManifest] No se pudo obtener URL de descarga después de todos los intentos para archivo ${fileId} del proyecto ${projectId}`);
          console.error(`[processCurseForgeModpackManifest] fileInfo completo:`, JSON.stringify(fileInfo, null, 2));
          if (required) {
            // En lugar de fallar completamente, registrar el error pero continuar
            // Muchos modpacks tienen archivos que pueden no estar disponibles pero no son críticos
            console.warn(`[processCurseForgeModpackManifest] ⚠️ Archivo requerido ${fileId} no disponible, pero continuando con el resto del modpack`);
            continue;
          }
          continue;
        }

        // Determinar carpeta de destino basada en el tipo de contenido
        // Por defecto, los mods van a la carpeta mods
        let targetDir = modsDir;
        const fileName = fileInfo.fileName || `curseforge-${projectId}-${fileId}.jar`;

        // Descargar el archivo
        const targetPath = path.join(targetDir, fileName);
        await this.downloadFileToPath(downloadUrl, targetPath);
        console.log(`Descargado ${fileName} a ${targetDir}`);

      } catch (error) {
        console.error(`Error al procesar archivo ${fileId} del proyecto ${projectId}:`, error);
        if (required) {
          throw error;
        }
      }
    }
  }

  /**
   * Descarga un archivo desde una URL a una ruta local
   */
  private async downloadFileToPath(url: string, filePath: string): Promise<void> {
    const fs = await import('fs');
    const https = await import('https');
    const http = await import('http');

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Seguir redirecciones
          return this.downloadFileToPath(response.headers.location!, filePath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);
          reject(new Error(`Error al descargar: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(err);
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(err);
      });
    });
  }
}

export const curseforgeService = new CurseForgeService();