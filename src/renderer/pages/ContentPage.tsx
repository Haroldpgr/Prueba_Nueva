import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { downloadService } from '../services/downloadService';
import { extractCurseForgeCompatibilityInfo } from '../../services/curseforgeApiHelper';
import { modrinthAPI, ModrinthProject } from '../services/ModrinthAPI_Handler';
import { curseForgeAPI, CurseForgeMod } from '../services/CurseForgeAPI_Handler';
import ContentCard from '../components/ContentCard';
import DownloadModalModrinth from '../components/DownloadModalModrinth';
import DownloadModalCurseForge from '../components/DownloadModalCurseForge';
import ContentDownloadProgressWidget from '../components/ContentDownloadProgressWidget';
import ModernContentDetail from '../components/ModernContentDetail';
import Tooltip from '../components/Tooltip';
import DownloadSelectionModal from '../components/DownloadSelectionModal';
import SingleDownloadModal from '../components/SingleDownloadModal';
import MultipleDownloadModal from '../components/MultipleDownloadModal';
import MultipleDownloadQueue from '../components/MultipleDownloadQueue';
import DownloadHistoryModal from '../components/DownloadHistoryModal';
import { multipleDownloadQueueService } from '../services/multipleDownloadQueueService';
import { showModernAlert, showModernConfirm } from '../utils/uiUtils';
import TutorialOverlay from '../components/TutorialOverlay';
import { contentTutorialSteps } from '../data/tutorialSteps';

type ContentType = 'modpacks' | 'mods' | 'resourcepacks' | 'datapacks' | 'shaders';
type SortBy = 'popular' | 'recent' | 'name';
type Platform = 'modrinth' | 'curseforge';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  lastUpdated: string;
  minecraftVersions: string[];
  categories: string[];
  imageUrl: string;
  type: ContentType;
  version: string;
  downloadUrl?: string; // Añadido para la URL de descarga real
  platform: Platform; // Added to identify the platform
}


const ContentPage: React.FC = () => {
  const { type = 'modpacks', id } = useParams<{ type?: ContentType; id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [selectedLoader, setSelectedLoader] = useState<string>(''); // Filtro de loader para la búsqueda externa
  const [detailVersion, setDetailVersion] = useState<string>(''); // Versión seleccionada en detalle (no afecta filtro)
  const [detailLoader, setDetailLoader] = useState<string>(''); // Loader seleccionado en detalle (no afecta filtro)
  const [compatibleLoaders, setCompatibleLoaders] = useState<string[]>([]); // Loaders compatibles
  const [compatibleVersions, setCompatibleVersions] = useState<string[]>([]); // Versiones compatibles
  const [installationProgress, setInstallationProgress] = useState<number>(0); // Progreso de instalación
  const [instances, setInstances] = useState<any[]>([]);
  const [showCustomFolder, setShowCustomFolder] = useState<boolean>(false);
  const [customFolderPath, setCustomFolderPath] = useState<string>('');
  const [content, setContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<{[key: string]: boolean}>({});
  const [downloadProgress, setDownloadProgress] = useState<{[key: string]: number}>({});
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [installedContent, setInstalledContent] = useState<Set<string>>(new Set()); // Contenido ya instalado
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('modrinth'); // New state to track selected platform

  // Leer el parámetro platform de la URL al cargar
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const platformParam = searchParams.get('platform');
    if (platformParam === 'curseforge' || platformParam === 'modrinth') {
      setSelectedPlatform(platformParam as Platform);
    }
  }, [location.search]);
  const [selectedModalProject, setSelectedModalProject] = useState<ModrinthProject | null>(null);
  const [selectedModalMod, setSelectedModalMod] = useState<CurseForgeMod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [availableLoaders, setAvailableLoaders] = useState<string[]>([]);
  const itemsPerPage = 20; // Mostrar 20 elementos por página

  // Cargar contenido desde Modrinth o CurseForge
  useEffect(() => {
    const loadInstancesAndContent = async () => {
      setIsLoading(true);
      try {
        // Cargar instancias del usuario
        if (window.api?.instances) {
          const userInstances = await window.api.instances.list();
          setInstances(userInstances);
        }

        // Cargar contenido desde la plataforma seleccionada usando la API original
        let results: ContentItem[] = [];
        if (selectedPlatform === 'modrinth') {
          console.log(`Buscando ${type} en Modrinth con término:`, searchQuery);
          results = await window.api.modrinth.search({
            contentType: type as ContentType,
            search: searchQuery
          });
          console.log('Resultados de Modrinth:', results);

          // Asegurar que el platform está definido
          results = results.map(item => ({
            ...item,
            platform: 'modrinth'
          }));
        } else if (selectedPlatform === 'curseforge') {
          console.log(`Buscando ${type} en CurseForge con término:`, searchQuery);
          results = await window.api.curseforge.search({
            contentType: type as ContentType,
            search: searchQuery
          });
          console.log('Resultados de CurseForge:', results);

          // Asegurar que el platform está definido
          results = results.map(item => ({
            ...item,
            platform: 'curseforge'
          }));
        }

        setContent(results);
        setCurrentPage(1); // Resetear a la primera página cuando se busca algo nuevo
      } catch (error) {
        console.error('Error al obtener datos:', error);
        // Mostrar mensaje de error al usuario
        if (error.message && error.message.includes('tiempo')) {
          await showModernAlert('Tiempo de espera agotado', 'La solicitud ha tardado demasiado. Por favor, verifica tu conexión e inténtalo de nuevo.', 'warning');
        } else {
          await showModernAlert('Error de conexión', 'No se pudieron cargar los datos. Por favor, verifica tu conexión e inténtalo de nuevo.', 'error');
        }
        setContent([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceLoad = setTimeout(() => {
      loadInstancesAndContent();
    }, 500); // Aumentamos el debounce a 500ms para evitar demasiadas llamadas

    return () => clearTimeout(debounceLoad);
  }, [type, searchQuery, selectedPlatform]); // Agregamos selectedLoader si necesitamos filtrar en el servidor

  // Estados para manejar el contenido filtrado y original
  const [displayedContent, setDisplayedContent] = useState<ContentItem[]>([]);
  const [originalContent, setOriginalContent] = useState<ContentItem[]>([]);
  // Caché para verificaciones de compatibilidad
  const compatibilityCache = React.useRef<Map<string, boolean>>(new Map());

  // Estados para los nuevos modales de descarga
  const [showDownloadSelectionModal, setShowDownloadSelectionModal] = useState<boolean>(false);
  const [showSingleDownloadModal, setShowSingleDownloadModal] = useState<boolean>(false);
  const [showMultipleDownloadModal, setShowMultipleDownloadModal] = useState<boolean>(false);
  const [showMultipleDownloadQueue, setShowMultipleDownloadQueue] = useState<boolean>(false);
  const [selectedDownloadItem, setSelectedDownloadItem] = useState<ContentItem | null>(null);
  const [showDownloadHistoryModal, setShowDownloadHistoryModal] = useState<boolean>(false);

  const handleDownload = (item: ContentItem) => {
    // Mostrar el modal de selección de tipo de descarga (individual o múltiple)
    setSelectedDownloadItem(item);
    setShowDownloadSelectionModal(true);
  };

  const handleSingleDownload = async () => {
    if (selectedDownloadItem) {
      setShowDownloadSelectionModal(false);

      try {
        // Valores por defecto
        let versionsToUse: string[] = [];
        let loadersToUse: string[] = [];

        // Intentar cargar desde APIs si están disponibles
        if (selectedPlatform === 'modrinth' && window.api?.modrinth?.getCompatibleVersions) {
          try {
            console.log('Solicitando versiones de Modrinth para:', selectedDownloadItem.id, 'Tipo:', selectedDownloadItem.type);
            const response = await window.api.modrinth.getCompatibleVersions({
              projectId: selectedDownloadItem.id,
              mcVersion: selectedDownloadItem.minecraftVersions[0] || '1.20.1'
            });

            console.log('Respuesta de Modrinth:', response);

            if (response && Array.isArray(response)) {
              // Extraer versiones estables de Minecraft desde la respuesta actual
              const extractedVersionsFromResponse = new Set<string>();

              for (const item of response) {
                // Intentar diferentes propiedades que pueden contener versiones
                if (item.game_versions && Array.isArray(item.game_versions)) {
                  for (const version of item.game_versions) {
                    if (typeof version === 'string' && version.startsWith('1.') &&
                        !version.includes('w') && !version.includes('pre') &&
                        !version.includes('rc') && !version.includes('snapshot')) {
                      extractedVersionsFromResponse.add(version);
                    }
                  }
                }
                // Comprobar también otras propiedades comunes
                else if (item.game_version && typeof item.game_version === 'string') {
                  if (item.game_version.startsWith('1.') &&
                      !item.game_version.includes('w') && !item.game_version.includes('pre') &&
                      !item.game_version.includes('rc') && !item.game_version.includes('snapshot')) {
                    extractedVersionsFromResponse.add(item.game_version);
                  }
                }
                else if (Array.isArray(item.versions)) {
                  for (const version of item.versions) {
                    if (typeof version === 'string' && version.startsWith('1.') &&
                        !version.includes('w') && !version.includes('pre') &&
                        !version.includes('rc') && !version.includes('snapshot')) {
                      extractedVersionsFromResponse.add(version);
                    }
                  }
                }
              }

              // Combinar versiones de la API con las versiones del contenido original
              // para tener una lista más completa de versiones posibles
              const allPossibleVersions = new Set<string>([
                ...extractedVersionsFromResponse,
                ...selectedDownloadItem.minecraftVersions
              ]);

              // Filtrar todas las versiones para incluir solo versiones estables
              versionsToUse = Array.from(allPossibleVersions)
                .filter(version =>
                  typeof version === 'string' &&
                  version.startsWith('1.') &&
                  !version.includes('w') &&
                  !version.includes('pre') &&
                  !version.includes('rc') &&
                  !version.includes('snapshot')
                )
                .sort((a, b) => {
                  // Dividir versiones por puntos y convertir a números para ordenar correctamente
                  const aParts = a.split('.').map(Number);
                  const bParts = b.split('.').map(Number);

                  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
                    if (aParts[i] !== bParts[i]) {
                      return bParts[i] - aParts[i]; // Orden descendente (1.21, 1.20, etc.)
                    }
                  }
                  return bParts.length - aParts.length; // Si todo es igual, más largo primero
                });

              console.log('Versiones extraídas de Modrinth (antes de ordenar):', Array.from(extractedVersionsFromResponse));
              console.log('Todas las posibles versiones combinadas:', Array.from(allPossibleVersions));
              console.log('Versiones filtradas finales:', versionsToUse);

              // Extraer loaders - considerar el tipo de contenido
              const extractedLoaders = new Set<string>();
              for (const item of response) {
                if (item.loaders && Array.isArray(item.loaders)) {
                  for (const loader of item.loaders) {
                    if (typeof loader === 'string') {
                      // Para diferentes tipos de contenido, usar loaders específicos
                      if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                        // Para mods y modpacks, usar loaders específicos
                        if (['forge', 'fabric', 'quilt', 'neoforge'].includes(loader)) {
                          extractedLoaders.add(loader);
                        }
                      } else {
                        // Para otros tipos, fabric puede ser suficiente o ninguno
                        extractedLoaders.add(loader);
                      }
                    }
                  }
                }
                // Comprobar otras propiedades posibles para loaders
                else if (item.loader && typeof item.loader === 'string') {
                  if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                    if (['forge', 'fabric', 'quilt', 'neoforge'].includes(item.loader)) {
                      extractedLoaders.add(item.loader);
                    }
                  } else {
                    extractedLoaders.add(item.loader);
                  }
                }
              }

              loadersToUse = Array.from(extractedLoaders);
              console.log('Loaders extraídos de Modrinth:', loadersToUse);
            }
          } catch (modrinthError) {
            console.error('Error obteniendo datos de Modrinth:', modrinthError);
          }
        } else if (selectedPlatform === 'curseforge' && window.api?.curseforge?.getCompatibleVersions) {
          try {
            console.log('Solicitando versiones de CurseForge para:', selectedDownloadItem.id, 'Tipo:', selectedDownloadItem.type);
            const response = await window.api.curseforge.getCompatibleVersions({
              projectId: selectedDownloadItem.id,
              mcVersion: selectedDownloadItem.minecraftVersions[0] || '1.20.1'
            });

            console.log('Respuesta de CurseForge:', response);

            if (response && Array.isArray(response)) {
              // Procesar igual que Modrinth - extraer versiones desde game_versions
              const extractedVersionsFromResponse = new Set<string>();

              for (const item of response) {
                // Intentar diferentes propiedades que pueden contener versiones
                if (item.game_versions && Array.isArray(item.game_versions)) {
                  for (const version of item.game_versions) {
                    if (typeof version === 'string' && version.startsWith('1.') &&
                        !version.includes('w') && !version.includes('pre') &&
                        !version.includes('rc') && !version.includes('snapshot')) {
                      extractedVersionsFromResponse.add(version);
                    }
                  }
                }
                // Comprobar también otras propiedades comunes
                else if (item.gameVersion && typeof item.gameVersion === 'string') {
                  if (item.gameVersion.startsWith('1.') &&
                      !item.gameVersion.includes('w') && !item.gameVersion.includes('pre') &&
                      !item.gameVersion.includes('rc') && !item.gameVersion.includes('snapshot')) {
                    extractedVersionsFromResponse.add(item.gameVersion);
                  }
                }
                else if (Array.isArray(item.versions)) {
                  for (const version of item.versions) {
                    if (typeof version === 'string' && version.startsWith('1.') &&
                        !version.includes('w') && !version.includes('pre') &&
                        !version.includes('rc') && !version.includes('snapshot')) {
                      extractedVersionsFromResponse.add(version);
                    }
                  }
                }
              }

              // Combinar versiones de la API con las versiones del contenido original
              // para tener una lista más completa de versiones posibles
              const allPossibleVersions = new Set<string>([
                ...extractedVersionsFromResponse,
                ...selectedDownloadItem.minecraftVersions
              ]);

              // Filtrar todas las versiones para incluir solo versiones estables
              versionsToUse = Array.from(allPossibleVersions)
                .filter(version =>
                  typeof version === 'string' &&
                  version.startsWith('1.') &&
                  !version.includes('w') &&
                  !version.includes('pre') &&
                  !version.includes('rc') &&
                  !version.includes('snapshot')
                )
                .sort((a, b) => {
                  // Dividir versiones por puntos y convertir a números para ordenar correctamente
                  const aParts = a.split('.').map(Number);
                  const bParts = b.split('.').map(Number);

                  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
                    if (aParts[i] !== bParts[i]) {
                      return bParts[i] - aParts[i]; // Orden descendente (1.21, 1.20, etc.)
                    }
                  }
                  return bParts.length - aParts.length; // Si todo es igual, más largo primero
                });

              console.log('Versiones extraídas de CurseForge (antes de ordenar):', Array.from(extractedVersionsFromResponse));
              console.log('Todas las posibles versiones combinadas:', Array.from(allPossibleVersions));
              console.log('Versiones filtradas finales:', versionsToUse);

              // Extraer loaders - considerar el tipo de contenido (igual que Modrinth)
              const extractedLoaders = new Set<string>();
              for (const item of response) {
                if (item.loaders && Array.isArray(item.loaders)) {
                  for (const loader of item.loaders) {
                    if (typeof loader === 'string') {
                      // Para diferentes tipos de contenido, usar loaders específicos
                      if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                        // Para mods y modpacks, usar loaders específicos
                        if (['forge', 'fabric', 'quilt', 'neoforge'].includes(loader)) {
                          extractedLoaders.add(loader);
                        }
                      } else {
                        // Para otros tipos, fabric puede ser suficiente o ninguno
                        extractedLoaders.add(loader);
                      }
                    }
                  }
                }
                // Comprobar otras propiedades posibles para loaders
                else if (item.loader && typeof item.loader === 'string') {
                  if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                    if (['forge', 'fabric', 'quilt', 'neoforge'].includes(item.loader)) {
                      extractedLoaders.add(item.loader);
                    }
                  } else {
                    extractedLoaders.add(item.loader);
                  }
                }
                // También verificar modLoader para compatibilidad
                else if (item.modLoader && typeof item.modLoader === 'string') {
                  const loaderLower = item.modLoader.toLowerCase();
                  if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                    if (['forge', 'fabric', 'quilt', 'neoforge'].includes(loaderLower)) {
                      extractedLoaders.add(loaderLower);
                    }
                  } else {
                    extractedLoaders.add(loaderLower);
                  }
                }
              }

              loadersToUse = Array.from(extractedLoaders);
              console.log('Loaders extraídos de CurseForge:', loadersToUse);
            }
          } catch (curseError) {
            console.error('Error obteniendo datos de CurseForge:', curseError);
          }
        }

        // Si no se encontró nada o hubo error, usar fallback
        if (versionsToUse.length === 0) {
          versionsToUse = selectedDownloadItem.minecraftVersions
            .filter((version: string) =>
              version.startsWith('1.') &&
              !version.includes('w') &&
              !version.includes('pre') &&
              !version.includes('rc') &&
              !version.includes('snapshot'))
            .sort((a: string, b: string) => {
              const [aMajor, aMinor, aPatch] = a.split('.').slice(1).map(Number);
              const [bMajor, bMinor, bPatch] = b.split('.').slice(1).map(Number);

              if (aMajor !== bMajor) return bMajor - aMajor;
              if (aMinor !== bMinor) return bMinor - aMinor;
              return (bPatch || 0) - (aPatch || 0);
            });
        }

        if (loadersToUse.length === 0) {
          loadersToUse = selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods'
            ? ['forge', 'fabric', 'quilt', 'neoforge']
            : [];
        }

        // Actualizar los estados
        setAvailableVersions(versionsToUse);
        setAvailableLoaders(loadersToUse);

        console.log('Datos cargados para el modal:', { versions: versionsToUse, loaders: loadersToUse });

        setShowSingleDownloadModal(true);
      } catch (error) {
        console.error('Error general en handleSingleDownload:', error);
        // Fallback en caso de error
        setAvailableVersions(selectedDownloadItem.minecraftVersions.filter((v: string) => v.startsWith('1.')) || []);
        setAvailableLoaders(['forge', 'fabric', 'quilt', 'neoforge']);
        setShowSingleDownloadModal(true);
      }
    }
  };

  const handleMultipleDownload = async () => {
    if (selectedDownloadItem) {
      setShowDownloadSelectionModal(false);

      try {
        // Cargar versiones y loaders compatibles para el download multiple
        let versionsToUse: string[] = [];
        let loadersToUse: string[] = [];

        if (selectedPlatform === 'modrinth' && window.api?.modrinth?.getCompatibleVersions) {
          try {
            const response = await window.api.modrinth.getCompatibleVersions({
              projectId: selectedDownloadItem.id,
              mcVersion: selectedDownloadItem.minecraftVersions[0] || '1.20.1'
            });

            if (response && Array.isArray(response)) {
              // Extraer versiones estables de Minecraft
              const extractedVersions = new Set<string>();

              for (const item of response) {
                if (item.game_versions && Array.isArray(item.game_versions)) {
                  for (const version of item.game_versions) {
                    if (typeof version === 'string' && version.startsWith('1.') &&
                        !version.includes('w') && !version.includes('pre') &&
                        !version.includes('rc') && !version.includes('snapshot')) {
                      extractedVersions.add(version);
                    }
                  }
                }
                // Comprobar otras propiedades posibles
                else if (item.game_version && typeof item.game_version === 'string') {
                  if (item.game_version.startsWith('1.') &&
                      !item.game_version.includes('w') && !item.game_version.includes('pre') &&
                      !item.game_version.includes('rc') && !item.game_version.includes('snapshot')) {
                    extractedVersions.add(item.game_version);
                  }
                }
                else if (Array.isArray(item.versions)) {
                  for (const version of item.versions) {
                    if (typeof version === 'string' && version.startsWith('1.') &&
                        !version.includes('w') && !version.includes('pre') &&
                        !version.includes('rc') && !version.includes('snapshot')) {
                      extractedVersions.add(version);
                    }
                  }
                }
              }

              // Combinar versiones de la API con las versiones del contenido original
              const allPossibleVersions = new Set<string>([
                ...extractedVersions,
                ...selectedDownloadItem.minecraftVersions
              ]);

              // Filtrar todas las versiones para incluir solo versiones estables
              versionsToUse = Array.from(allPossibleVersions)
                .filter(version =>
                  typeof version === 'string' &&
                  version.startsWith('1.') &&
                  !version.includes('w') &&
                  !version.includes('pre') &&
                  !version.includes('rc') &&
                  !version.includes('snapshot')
                )
                .sort((a, b) => {
                  // Dividir versiones por puntos y convertir a números para ordenar correctamente
                  const aParts = a.split('.').map(Number);
                  const bParts = b.split('.').map(Number);

                  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
                    if (aParts[i] !== bParts[i]) {
                      return bParts[i] - aParts[i]; // Orden descendente (1.21, 1.20, etc.)
                    }
                  }
                  return bParts.length - aParts.length; // Si todo es igual, más largo primero
                });

              // Extraer loaders
              const extractedLoaders = new Set<string>();
              for (const item of response) {
                if (item.loaders && Array.isArray(item.loaders)) {
                  for (const loader of item.loaders) {
                    if (typeof loader === 'string') {
                      // Para diferentes tipos de contenido, usar loaders específicos
                      if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                        // Para mods y modpacks, usar loaders específicos
                        if (['forge', 'fabric', 'quilt', 'neoforge'].includes(loader)) {
                          extractedLoaders.add(loader);
                        }
                      } else {
                        extractedLoaders.add(loader);
                      }
                    }
                  }
                }
                // Comprobar otra propiedad posible para loaders
                else if (item.loader && typeof item.loader === 'string') {
                  if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                    if (['forge', 'fabric', 'quilt', 'neoforge'].includes(item.loader)) {
                      extractedLoaders.add(item.loader);
                    }
                  } else {
                    extractedLoaders.add(item.loader);
                  }
                }
              }

              loadersToUse = Array.from(extractedLoaders);
            }
          } catch (modrinthError) {
            console.error('Error obteniendo datos de Modrinth para download múltiple:', modrinthError);
          }
        } else if (selectedPlatform === 'curseforge' && window.api?.curseforge?.getCompatibleVersions) {
          try {
            const response = await window.api.curseforge.getCompatibleVersions({
              projectId: selectedDownloadItem.id,
              mcVersion: selectedDownloadItem.minecraftVersions[0] || '1.20.1'
            });

            if (response && Array.isArray(response)) {
              const processedInfo = extractCurseForgeCompatibilityInfo(response);

              // Combinar versiones de la API con las versiones del contenido original
              const allPossibleVersions = new Set<string>([
                ...processedInfo.gameVersions,
                ...selectedDownloadItem.minecraftVersions
              ]);

              // Filtrar todas las versiones para incluir solo versiones estables
              versionsToUse = Array.from(allPossibleVersions)
                .filter((version: string) =>
                  typeof version === 'string' &&
                  version.startsWith('1.') &&
                  !version.includes('w') &&
                  !version.includes('pre') &&
                  !version.includes('rc') &&
                  !version.includes('snapshot'))
                .sort((a: string, b: string) => {
                  // Dividir versiones por puntos y convertir a números para ordenar correctamente
                  const aParts = a.split('.').map(Number);
                  const bParts = b.split('.').map(Number);

                  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
                    if (aParts[i] !== bParts[i]) {
                      return bParts[i] - aParts[i]; // Orden descendente (1.21, 1.20, etc.)
                    }
                  }
                  return bParts.length - aParts.length; // Si todo es igual, más largo primero
                });

              // Usar loaders apropiados para el tipo de contenido
              if (selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods') {
                // Filtrar solo loaders válidos para mods y modpacks
                loadersToUse = processedInfo.modLoaders.filter((loader: string) =>
                  ['forge', 'fabric', 'quilt', 'neoforge'].includes(loader)
                );
              } else {
                // Para otros tipos de contenido, usar los loaders disponibles o dejarlo vacío
                loadersToUse = processedInfo.modLoaders;
              }
            }
          } catch (curseError) {
            console.error('Error obteniendo datos de CurseForge para download múltiple:', curseError);
          }
        }

        // Si no se encontró nada o hubo error, usar fallback
        if (versionsToUse.length === 0) {
          versionsToUse = selectedDownloadItem.minecraftVersions
            .filter((version: string) =>
              version.startsWith('1.') &&
              !version.includes('w') &&
              !version.includes('pre') &&
              !version.includes('rc') &&
              !version.includes('snapshot'))
            .sort((a: string, b: string) => {
              const [aMajor, aMinor, aPatch] = a.split('.').slice(1).map(Number);
              const [bMajor, bMinor, bPatch] = b.split('.').slice(1).map(Number);

              if (aMajor !== bMajor) return bMajor - aMajor;
              if (aMinor !== bMinor) return bMinor - aMinor;
              return (bPatch || 0) - (aPatch || 0);
            });
        }

        if (loadersToUse.length === 0) {
          loadersToUse = selectedDownloadItem.type === 'modpacks' || selectedDownloadItem.type === 'mods'
            ? ['forge', 'fabric', 'quilt', 'neoforge']
            : [];
        }

        // Actualizar los estados con las versiones y loaders obtenidos
        setAvailableVersions(versionsToUse);
        setAvailableLoaders(loadersToUse);

        console.log('Datos cargados para el modal múltiple:', { versions: versionsToUse, loaders: loadersToUse });

        setShowMultipleDownloadModal(true);
      } catch (error) {
        console.error('Error general en handleMultipleDownload:', error);
        // Aunque haya error, mostrar modal de todas formas con datos básicos
        setShowMultipleDownloadModal(true);
      }
    }
  };

  const handleStartSingleDownload = async (downloadInfo: {
    id: string;
    name: string;
    version: string;
    loader?: string;
    targetPath: string;
    platform: string;
  }) => {
    // Buscar el elemento correspondiente
    const item = content.find(c => c.id === downloadInfo.id);
    if (!item) {
      console.error('No se encontró el ítem para descargar:', downloadInfo.id);
      return;
    }

    // Iniciar la descarga individual con la información proporcionada
    console.log('Iniciando descarga individual con:', downloadInfo);

    // Actualizar el estado con la información de la descarga
    if (downloadInfo.targetPath) {
      // Si la ruta no es una instancia predefinida, usar ruta personalizada
      if (instances.some(instance => instance.path === downloadInfo.targetPath)) {
        // Si es una instancia existente, encontrar su ID
        const instanceId = instances.find(instance => instance.path === downloadInfo.targetPath)?.id;
        setSelectedInstanceId(instanceId || '');
      } else {
        // Si es una ruta personalizada, usar el sistema de carpeta personalizada
        setSelectedInstanceId('custom');
        setCustomFolderPath(downloadInfo.targetPath);
      }
    } else {
      setSelectedInstanceId(''); // No se ha seleccionado ninguna instancia
    }

    // NO actualizar los filtros de la página principal cuando se selecciona en el modal
    // Los filtros deben mantenerse independientes de las selecciones del modal
    // Usar la función auxiliar que acepta parámetros sin afectar los filtros globales
    // Pasar el targetPath para evitar el diálogo de confirmación
    await handleDownloadAndInstallWithParams(item, downloadInfo.version, downloadInfo.loader, downloadInfo.targetPath);

    // Cerrar el modal
    setShowSingleDownloadModal(false);
  };

  const handleAddToMultipleQueue = (queueItems: Array<{
    originalId: string;
    name: string;
    version: string;
    loader?: string;
    targetPath: string;
    platform: string;
    contentType?: 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'modpack';
  }>) => {
    // Agregar los elementos a la cola de descargas múltiples
    console.log('Agregando a cola múltiple:', queueItems);

    // Usar el servicio de cola (import estático para evitar advertencias de Vite)
      multipleDownloadQueueService.addToQueue(queueItems);

    // Cerrar el modal de descarga múltiple
    setShowMultipleDownloadModal(false);

    // Mostrar la cola de descargas múltiples
    setShowMultipleDownloadQueue(true);
  };

  const handleStartMultipleDownload = () => {
    // Iniciar la descarga de todos los elementos en la cola
    console.log('Iniciando descarga múltiple');

    // Cerrar la cola
    setShowMultipleDownloadQueue(false);
  };

  // Efecto para actualizar contenido original cuando cambia el tipo o plataforma
  useEffect(() => {
    setOriginalContent(content);
    setDisplayedContent(content);
  }, [content, type, selectedPlatform]);

  // Verificar compatibilidad de versión y loader cuando cambian
  useEffect(() => {
    const checkCompatibility = async () => {
      // Limpiar caché cuando cambian los filtros
      compatibilityCache.current.clear();
      
      // Si no hay filtros de loader o versión, mostrar todo
      if (!selectedLoader && selectedVersion === 'all') {
        setDisplayedContent([...originalContent]);
        return;
      }

      // Solo aplicar filtros de compatibilidad para mods y modpacks
      if (originalContent.length > 0 && (type === 'modpacks' || type === 'mods')) {
        setIsLoading(true);
        try {
          const versionToCheck = selectedVersion !== 'all' ? selectedVersion : null;
          
          // Verificar compatibilidad en paralelo
          const compatibilityChecks = originalContent.map(async (item) => {
            try {
              // Crear clave de caché
              const cacheKey = `${item.id}-${item.platform}-${versionToCheck || 'any'}-${selectedLoader || 'any'}`;
              
              // Verificar caché
              if (compatibilityCache.current.has(cacheKey)) {
                return compatibilityCache.current.get(cacheKey) ? item : null;
              }
              
              let compatibleVersions: any[] = [];
              const mcVersion = versionToCheck || item.minecraftVersions?.[0] || '1.20.1';

              if (item.platform === 'modrinth') {
                compatibleVersions = await modrinthAPI.getCompatibleVersions({
                  projectId: item.id,
                  mcVersion: mcVersion,
                  loader: selectedLoader || undefined
                });
              } else if (item.platform === 'curseforge') {
                compatibleVersions = await window.api.curseforge.getCompatibleVersions({
                  projectId: item.id,
                  mcVersion: mcVersion,
                  loader: selectedLoader || undefined
                });
              }

              const isCompatible = compatibleVersions.length > 0;
              compatibilityCache.current.set(cacheKey, isCompatible);
              
              return isCompatible ? item : null;
            } catch (error) {
              console.error(`Error checking compatibility for item ${item.id}:`, error);
              // Si hay error verificando, asumir que NO es compatible para evitar mostrar contenido no disponible
              return null;
            }
          });

          // Esperar a que todas las promesas se resuelvan
          const results = await Promise.all(compatibilityChecks);

          // Filtrar los resultados nulos
          const filteredResults = results.filter(item => item !== null) as ContentItem[];

          setDisplayedContent(filteredResults);
        } catch (error) {
          console.error('Error en verificación de compatibilidad:', error);
          setDisplayedContent([...originalContent]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Para otros tipos de contenido, aplicar solo filtro de versión si está seleccionado
        if (selectedVersion !== 'all') {
          const filtered = originalContent.filter(item =>
            item.minecraftVersions?.includes(selectedVersion)
          );
          setDisplayedContent(filtered);
        } else {
          setDisplayedContent([...originalContent]);
        }
      }
    };

    checkCompatibility();
  }, [selectedLoader, selectedVersion, selectedPlatform, originalContent, type]);

  // Filter and sort content (versión ya filtrada en displayedContent, solo aplicar categoría y ordenamiento)
  const filteredContent = React.useMemo(() => {
    let result = [...displayedContent];

    // Apply category filter
    if (selectedCategory !== 'all') {
      result = result.filter(item =>
        item.categories && item.categories.includes(selectedCategory)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.author?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.downloads || 0) - (a.downloads || 0);
        case 'recent':
          return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
        case 'name':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [displayedContent, selectedCategory, sortBy, searchQuery]);

  // Get paginated content
  const paginatedContent = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredContent.slice(startIndex, endIndex);
  }, [filteredContent, currentPage, itemsPerPage]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredContent.length / itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top when changing pages
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  // Set selected content when ID changes and check installation status
  useEffect(() => {
    const controller = new AbortController();

    const loadSelectedContent = async () => {
      if (id) {
        let item = content.find(item => item.id === id);

        if (item) {
          // Create a copy of the item to prevent directly modifying the original
          const updatedItem = { ...item };

          // Fetch additional information in the background without blocking the UI
          if (item.platform === 'curseforge') {
            try {
              const modId = parseInt(item.id, 10);
              if (!isNaN(modId)) {
                // Implementar timeout para la llamada a CurseForge
                const fetchWithTimeout = (promise: Promise<any>, timeoutMs: number) => {
                  return Promise.race([
                    promise,
                    new Promise((_, reject) =>
                      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
                    )
                  ]);
                };

                // Fetch CurseForge details with timeout protection
                const modPromise = fetchWithTimeout(curseForgeAPI.getMod(modId), 10000);
                const filePromise = fetchWithTimeout(curseForgeAPI.getModFiles(modId), 10000);

                try {
                  const mod = await modPromise;
                  const modFiles = await filePromise;

                  // Extract all Minecraft versions from the mod files
                  const allGameVersions = new Set<string>();
                  modFiles.forEach(file => {
                    if (file.gameVersions && Array.isArray(file.gameVersions)) {
                      file.gameVersions.forEach(version => allGameVersions.add(version));
                    }
                  });
                  const gameVersionsArray = Array.from(allGameVersions);

                  // Update the item with real Minecraft versions and description
                  updatedItem.minecraftVersions = gameVersionsArray;
                  updatedItem.description = mod.summary || mod.description || item.description;
                } catch (fetchError) {
                  console.error('CurseForge request timed out or failed:', fetchError);
                  // If there's a timeout or other error, continue with original data
                }
              }
            } catch (error) {
              console.error('Error processing CurseForge item:', error);
              // If there's an error, continue with original data
            }
          } else if (item.platform === 'modrinth') {
            // For Modrinth items, fetch detailed information to get accurate description
            try {
              const projectId = item.id;

              // Implement timeout for Modrinth request
              const fetchWithTimeout = (promise: Promise<any>, timeoutMs: number) => {
                return Promise.race([
                  promise,
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
                  )
                ]);
              };

              try {
                const project = await fetchWithTimeout(modrinthAPI.getProject(projectId), 10000);

                // Update the item with the real description from Modrinth API
                updatedItem.description = project.description || project.body || item.description;
              } catch (fetchError) {
                console.error('Modrinth request timed out or failed:', fetchError);
                // If there's a timeout or other error, continue with original data
              }
            } catch (error) {
              console.error('Error processing Modrinth item:', error);
              // If there's an error, continue with original data
            }
          }

          // Always set the selected content, whether the detailed data retrieval succeeded or failed
          setSelectedContent(updatedItem);
          await loadCompatibleVersionsAndLoaders(updatedItem);
        } else {
          setSelectedContent(null);
          setCompatibleVersions([]);
          setCompatibleLoaders([]);
        }
      } else {
        setSelectedContent(null);
        setCompatibleVersions([]);
        setCompatibleLoaders([]);
      }
    };

    loadSelectedContent();

    // Cleanup function
    return () => {
      controller.abort(); // Abort any ongoing requests when component unmounts
    };
  }, [id, content]);

  // Función para cargar versiones y loaders compatibles desde la plataforma seleccionada
  const loadCompatibleVersionsAndLoaders = async (item: ContentItem) => {
    try {
      // Verificar si el método está disponible antes de usarlo, dependiendo de la plataforma

      // Para mostrar todas las versiones posibles, primero vamos a obtener la información básica del item
      // y luego consultar la API para obtener todas las versiones y loaders disponibles

      if (selectedPlatform === 'modrinth' && window.api.modrinth.getCompatibleVersions) {
        // Para Modrinth, necesitamos una estrategia diferente para obtener todas las versiones
        // Consultamos sin parámetros específicos
        let allVersions: string[] = [];
        let allLoaders: string[] = [];

        // Primero, intentemos obtener todas las versiones posibles desde el contenido original
        allVersions = [...new Set(item.minecraftVersions)];

        // Luego, intentamos obtener información más detallada de la API
        try {
          // Intentamos obtener todas las versiones posibles para este proyecto
          // La API de Modrinth requiere al menos un parámetro, así que usamos uno genérico
          const allCompatibleVersions = await window.api.modrinth.getCompatibleVersions({
            projectId: item.id,
            mcVersion: item.minecraftVersions[0] || '1.20.1' // Usamos la primera versión disponible para obtener los datos
            // No especificamos loader para obtener todas las combinaciones posibles
          });

          // Extraer todas las versiones posibles de todas las versiones compatibles
          const gameVersions = new Set<string>();
          allCompatibleVersions.forEach((version: any) => {
            if (version.game_versions) {
              version.game_versions.forEach((v: string) => gameVersions.add(v));
            }
          });

          // Combinar las versiones obtenidas de la API con las del contenido original
          allVersions = Array.from(new Set([...allVersions, ...gameVersions]))
            .filter(version => {
              const isStableVersion = /^1\.\d{1,2}(\.\d{1,2})?$/.test(version);
              const isNotPreRelease = !version.includes('pre');
              const isNotReleaseCandidate = !version.includes('rc');
              const isNotSnapshot = !version.includes('snapshot');
              const isNotWeekVersion = !version.includes('w');
              const isNotSpecial = !version.includes('infinite');
              const isNotHyphenated = !version.includes('-');

              return isStableVersion && isNotPreRelease && isNotReleaseCandidate &&
                     isNotSnapshot && isNotWeekVersion && isNotSpecial && isNotHyphenated;
            })
            .sort((a, b) => {
              const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
              const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

              if (aMajor !== bMajor) return bMajor - aMajor;  // Mayor número de versión mayor primero
              if (aMinor !== bMinor) return bMinor - aMinor;  // Mayor número de versión menor primero
              return (bPatch || 0) - (aPatch || 0);          // Mayor número de parche primero
            });

          // Extraer todos los loaders de todas las versiones
          const loaderSet = new Set<string>();
          allCompatibleVersions.forEach((version: any) => {
            if (version.loaders) {
              version.loaders.forEach((l: string) => loaderSet.add(l));
            }
          });

          allLoaders = Array.from(loaderSet);
        } catch (apiError) {
          console.error('Error obteniendo versiones compatibles de Modrinth:', apiError);
          // Fallback: usar las versiones del item original
          allVersions = item.minecraftVersions
            .filter(version => {
              const isStableVersion = /^1\.\d{1,2}(\.\d{1,2})?$/.test(version);
              const isNotPreRelease = !version.includes('pre');
              const isNotReleaseCandidate = !version.includes('rc');
              const isNotSnapshot = !version.includes('snapshot');
              const isNotWeekVersion = !version.includes('w');
              const isNotSpecial = !version.includes('infinite');
              const isNotHyphenated = !version.includes('-');

              return isStableVersion && isNotPreRelease && isNotReleaseCandidate &&
                     isNotSnapshot && isNotWeekVersion && isNotSpecial && isNotHyphenated;
            })
            .sort((a, b) => {
              const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
              const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

              if (aMajor !== bMajor) return bMajor - aMajor;  // Mayor número de versión mayor primero
              if (aMinor !== bMinor) return bMinor - aMinor;  // Mayor número de versión menor primero
              return (bPatch || 0) - (aPatch || 0);          // Mayor número de parche primero
            });

          allLoaders = ['forge', 'fabric', 'quilt', 'neoforge'];
        }

        setCompatibleVersions(allVersions);
        setCompatibleLoaders(allLoaders);
      } else if (selectedPlatform === 'curseforge' && window.api.curseforge.getCompatibleVersions) {
        // Para CurseForge, seguimos una estrategia similar
        let allVersions: string[] = [];
        let allLoaders: string[] = [];

        // Primero, usamos las versiones del item original
        allVersions = [...new Set(item.minecraftVersions)];

        console.log('DEBUG - CurseForge: Iniciando carga de compatibilidad para item:', item);
        console.log('DEBUG - CurseForge: projectId:', item.id);
        console.log('DEBUG - CurseForge: mcVersions disponibles:', item.minecraftVersions);

        // Si no hay versiones en el item original, usar algunas versiones comunes como fallback
        if (!item.minecraftVersions || item.minecraftVersions.length === 0) {
          console.log('DEBUG - CurseForge: No hay versiones en el item original, usando versiones comunes como fallback');
          allVersions = [
            '1.21.1', '1.21', '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1',
            '1.19.4', '1.19.3', '1.19.2', '1.18.2', '1.17.1', '1.16.5', '1.15.2', '1.14.4',
            '1.13.2', '1.12.2', '1.11.2', '1.10.2', '1.9.4', '1.8.9'
          ];
        }

        // Para CurseForge, vamos a intentar obtener la información de compatibilidad real
        // pero con un enfoque que no dependa de una API externa que pueda fallar

        // Intentamos obtener la información de compatibilidad real desde CurseForge API
        try {
          console.log('DEBUG - CurseForge: Intentando llamar a la API para compatibilidad...');
          // Usar la primera versión disponible, o si no hay, usar una versión común
          const mcVersionToUse = (item.minecraftVersions && item.minecraftVersions.length > 0)
            ? item.minecraftVersions[0]
            : '1.20.1';

          console.log('DEBUG - CurseForge: Llamando API con projectId:', item.id, 'y mcVersion:', mcVersionToUse);

          const curseForgeResponse = await window.api.curseforge.getCompatibleVersions({
            projectId: item.id,
            mcVersion: mcVersionToUse
            // No especificamos loader para obtener todos los disponibles
          });

          console.log('DEBUG - CurseForge: Respuesta de la API:', curseForgeResponse);

          // Verificar si la respuesta tiene la estructura esperada
          if (curseForgeResponse && Array.isArray(curseForgeResponse) && curseForgeResponse.length > 0) {
            console.log('DEBUG - CurseForge: Procesando', curseForgeResponse.length, 'elementos de la respuesta');
            // Procesar la respuesta para extraer versiones y loaders específicos
            const processedInfo = extractCurseForgeCompatibilityInfo(curseForgeResponse);
            console.log('DEBUG - CurseForge: Información procesada:', processedInfo);

            // Usar solo las versiones que están en la respuesta de la API
            allVersions = processedInfo.gameVersions
              .filter(version => {
                const isStableVersion = /^1\.\d{1,2}(\.\d{1,2})?$/.test(version);
                const isNotPreRelease = !version.includes('pre');
                const isNotReleaseCandidate = !version.includes('rc');
                const isNotSnapshot = !version.includes('snapshot');
                const isNotWeekVersion = !version.includes('w');
                const isNotSpecial = !version.includes('infinite');
                const isNotHyphenated = !version.includes('-');

                return isStableVersion && isNotPreRelease && isNotReleaseCandidate &&
                       isNotSnapshot && isNotWeekVersion && isNotSpecial && isNotHyphenated;
              })
              .sort((a, b) => {
                const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
                const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

                if (aMajor !== bMajor) return bMajor - aMajor;  // Mayor número de versión mayor primero
                if (aMinor !== bMinor) return bMinor - aMinor;  // Mayor número de versión menor primero
                return (bPatch || 0) - (aPatch || 0);          // Mayor número de parche primero
              });

            // Usar los loaders obtenidos de la API
            allLoaders = processedInfo.modLoaders;
            console.log('DEBUG - CurseForge: Versiones finales (filtradas):', allVersions);
            console.log('DEBUG - CurseForge: Loaders finales:', allLoaders);
          } else {
            console.log('DEBUG - CurseForge: No se recibieron datos compatibles, usando info del item original');
            // Si no hay respuesta específica de la API, usar información del item original
            allVersions = item.minecraftVersions
              .filter(version => {
                const isStableVersion = /^1\.\d{1,2}(\.\d{1,2})?$/.test(version);
                const isNotPreRelease = !version.includes('pre');
                const isNotReleaseCandidate = !version.includes('rc');
                const isNotSnapshot = !version.includes('snapshot');
                const isNotWeekVersion = !version.includes('w');
                const isNotSpecial = !version.includes('infinite');
                const isNotHyphenated = !version.includes('-');

                return isStableVersion && isNotPreRelease && isNotReleaseCandidate &&
                       isNotSnapshot && isNotWeekVersion && isNotSpecial && isNotHyphenated;
              })
              .sort((a, b) => {
                const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
                const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

                if (aMajor !== bMajor) return bMajor - aMajor;  // Mayor número de versión mayor primero
                if (aMinor !== bMinor) return bMinor - aMinor;  // Mayor número de versión menor primero
                return (bPatch || 0) - (aPatch || 0);          // Mayor número de parche primero
              });

            // Cargar los loaders disponibles según el tipo de contenido
            if (item.type === 'modpacks' || item.type === 'mods') {
              allLoaders = ['forge', 'fabric', 'quilt', 'neoforge'];
            } else {
              allLoaders = []; // Otros tipos no requieren loaders específicos
            }
          }
        } catch (error) {
          console.error('ERROR - CurseForge: Error obteniendo compatibilidad de CurseForge, usando datos del item:', error);
          console.error('ERROR - CurseForge: Detalles del error:', error instanceof Error ? error.message : 'Error desconocido');

          allVersions = item.minecraftVersions
            .filter(version => {
              const isStableVersion = /^1\.\d{1,2}(\.\d{1,2})?$/.test(version);
              const isNotPreRelease = !version.includes('pre');
              const isNotReleaseCandidate = !version.includes('rc');
              const isNotSnapshot = !version.includes('snapshot');
              const isNotWeekVersion = !version.includes('w');
              const isNotSpecial = !version.includes('infinite');
              const isNotHyphenated = !version.includes('-');

              return isStableVersion && isNotPreRelease && isNotReleaseCandidate &&
                     isNotSnapshot && isNotWeekVersion && isNotSpecial && isNotHyphenated;
            })
            .sort((a, b) => {
              const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
              const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

              if (aMajor !== bMajor) return bMajor - aMajor;  // Mayor número de versión mayor primero
              if (aMinor !== bMinor) return bMinor - aMinor;  // Mayor número de versión menor primero
              return (bPatch || 0) - (aPatch || 0);          // Mayor número de parche primero
            });

          // Cargar los loaders disponibles según el tipo de contenido
          if (item.type === 'modpacks' || item.type === 'mods') {
            allLoaders = ['forge', 'fabric', 'quilt', 'neoforge'];
          } else {
            allLoaders = []; // Otros tipos no requieren loaders específicos
          }
        }

        setCompatibleVersions(allVersions);
        setCompatibleLoaders(allLoaders);
      } else {
        // Fallback: usar las versiones y loaders originales del contenido del item
        const filteredVersions = item.minecraftVersions
          .filter(version => {
            const isStableVersion = /^1\.\d{1,2}(\.\d{1,2})?$/.test(version);
            const isNotPreRelease = !version.includes('pre');
            const isNotReleaseCandidate = !version.includes('rc');
            const isNotSnapshot = !version.includes('snapshot');
            const isNotWeekVersion = !version.includes('w');
            const isNotSpecial = !version.includes('infinite');
            const isNotHyphenated = !version.includes('-');

            return isStableVersion && isNotPreRelease && isNotReleaseCandidate &&
                   isNotSnapshot && isNotWeekVersion && isNotSpecial && isNotHyphenated;
          })
          .sort((a, b) => {
            const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
            const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

            if (aMajor !== bMajor) return bMajor - aMajor;  // Mayor número de versión mayor primero
            if (aMinor !== bMinor) return bMinor - aMinor;  // Mayor número de versión menor primero
            return (bPatch || 0) - (aPatch || 0);          // Mayor número de parche primero
          });

        setCompatibleVersions(filteredVersions);

        // Para los loaders, usar una lógica basada en el tipo de contenido
        let possibleLoaders: string[] = [];
        if (item.type === 'modpacks' || item.type === 'mods') {
          // Para mods y modpacks, los loaders comunes son forge, fabric, etc.
          possibleLoaders = ['forge', 'fabric', 'quilt', 'neoforge'];
        }
        // Para otros tipos no se requieren loaders específicos
        setCompatibleLoaders(possibleLoaders);
      }
    } catch (error) {
      console.error('Error al cargar versiones y loaders compatibles:', error);
      // En caso de error, usar las versiones originales del contenido
      const filteredVersions = item.minecraftVersions
        .filter(version => {
          const isStableVersion = /^1\.\d{1,2}(\.\d{1,2})?$/.test(version);
          const isNotPreRelease = !version.includes('pre');
          const isNotReleaseCandidate = !version.includes('rc');
          const isNotSnapshot = !version.includes('snapshot');
          const isNotWeekVersion = !version.includes('w');
          const isNotSpecial = !version.includes('infinite');
          const isNotHyphenated = !version.includes('-');

          return isStableVersion && isNotPreRelease && isNotReleaseCandidate &&
                 isNotSnapshot && isNotWeekVersion && isNotSpecial && isNotHyphenated;
        })
        .sort((a, b) => {
          const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
          const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

          if (aMajor !== bMajor) return bMajor - aMajor;  // Mayor número de versión mayor primero
          if (aMinor !== bMinor) return bMinor - aMinor;  // Mayor número de versión menor primero
          return (bPatch || 0) - (aPatch || 0);          // Mayor número de parche primero
        });

      setCompatibleVersions(filteredVersions);

      // Para los loaders, usar una lógica basada en el tipo de contenido
      let possibleLoaders: string[] = [];
      if (item.type === 'modpacks' || item.type === 'mods') {
        // Para mods y modpacks, los loaders comunes son forge, fabric, etc.
        possibleLoaders = ['forge', 'fabric', 'quilt', 'neoforge'];
      }
      // Para otros tipos no se requieren loaders específicos
      setCompatibleLoaders(possibleLoaders);
    }
  };

  // Check installation status when selectedInstanceId or selectedContent changes
  useEffect(() => {
    if (selectedInstanceId && selectedContent) {
      if (installedContent.has(`${selectedInstanceId}-${selectedContent.id}`)) {
        // Estado ya está registrado como instalado
      } else {
        // Aquí se podría verificar si está instalado realmente en la instancia
        // Por ahora solo lo dejamos como no instalado hasta que se complete la instalación
      }
    }
  }, [selectedInstanceId, selectedContent, installedContent]);

  // Actualizar versiones y loaders compatibles cuando cambia la selección
  useEffect(() => {
    if (selectedContent) {
      loadCompatibleVersionsAndLoaders(selectedContent);
    }
  }, [selectedContent, selectedPlatform]);

  const handleContentClick = (itemId: string) => {
    // Find the item in content array
    const item = content.find(i => i.id === itemId);
    if (!item) return;

    navigate(`/contenido/${type}/${item.id}`);
  };

  const handleBackToList = () => {
    navigate(`/contenido/${type}`);
  };

  // Función auxiliar que acepta parámetros sin afectar los filtros globales
  const handleDownloadAndInstallWithParams = async (
    item: ContentItem,
    mcVersion: string,
    loader?: string,
    targetPathParam?: string
  ) => {
    setIsDownloading(prev => ({ ...prev, [item.id]: true }));
    setInstallationProgress(0);

    try {
      let contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'modpack';
      switch (item.type) {
        case 'resourcepacks':
          contentType = 'resourcepack';
          break;
        case 'shaders':
          contentType = 'shader';
          break;
        case 'datapacks':
          contentType = 'datapack';
          break;
        case 'modpacks':
          contentType = 'modpack';
          break;
        default:
          contentType = 'mod';
      }

      // Si se pasó un targetPath desde el modal, usarlo directamente sin mostrar diálogo
      const hasTargetPath = targetPathParam && targetPathParam.trim() !== '';
      
      if (!selectedInstanceId && !hasTargetPath) {
        const userChoice = await showModernConfirm(
          'Sin instancia seleccionada',
          `No has seleccionado una instancia.\n¿Quieres descargar "${item.title}" directamente a la zona de descargas?\n\nCancela para seleccionar una instancia en su lugar.`,
          'info'
        );
        if (!userChoice) {
          await showModernAlert('Información', 'Por favor, selecciona una instancia para instalar el contenido.', 'info');
          return;
        }

        let compatibleVersions: any[] = [];
        if (selectedPlatform === 'modrinth') {
          compatibleVersions = await window.api.modrinth.getCompatibleVersions({
            projectId: item.id,
            mcVersion: mcVersion || item.minecraftVersions[0] || '1.20.1',
            loader: loader
          });
        } else if (selectedPlatform === 'curseforge') {
          compatibleVersions = await window.api.curseforge.getCompatibleVersions({
            projectId: item.id,
            mcVersion: mcVersion || item.minecraftVersions[0] || '1.20.1',
            loader: loader
          });
        }

        if (compatibleVersions.length === 0) {
          alert('No se encontraron versiones compatibles para descargar');
          return;
        }

        const targetVersion = compatibleVersions[0];
        let primaryFile: any = null;
        if (selectedPlatform === 'modrinth') {
          primaryFile = targetVersion.files.find((f: any) => f.primary) || targetVersion.files[0];
        } else if (selectedPlatform === 'curseforge') {
          primaryFile = targetVersion.files ? targetVersion.files[0] : null;
        }

        if (!primaryFile) {
          await showModernAlert('Sin archivos', 'No se encontraron archivos para descargar', 'warning');
          return;
        }

        downloadService.downloadFile(
          primaryFile.url || primaryFile.downloadUrl,
          primaryFile.filename || primaryFile.fileName,
          item.title
        );

        await showModernAlert('Descarga iniciada', `${item.title} se está descargando en la zona de descargas.`, 'success');
      } else {
        // Si hay targetPath desde el modal, validar solo versión y loader, luego proceder directamente
        if (hasTargetPath) {
          // Validaciones mínimas cuando hay targetPath desde el modal
          if (!mcVersion || mcVersion === 'all' || mcVersion === '') {
            await showModernAlert('Campo requerido', 'Por favor, selecciona una versión de Minecraft.', 'warning');
            return;
          }

          if ((contentType === 'mod' || contentType === 'modpack') && !loader) {
            await showModernAlert('Campo requerido', 'Por favor, selecciona un loader compatible.', 'warning');
            return;
          }

          // Obtener versiones compatibles para verificar
          let compatibleVersionsCheck: any[] = [];
          if (selectedPlatform === 'modrinth' && window.api.modrinth.getCompatibleVersions) {
            compatibleVersionsCheck = await window.api.modrinth.getCompatibleVersions({
              projectId: item.id,
              mcVersion: mcVersion,
              loader: loader || undefined
            });
          } else if (selectedPlatform === 'curseforge' && window.api.curseforge.getCompatibleVersions) {
            compatibleVersionsCheck = await window.api.curseforge.getCompatibleVersions({
              projectId: item.id,
              mcVersion: mcVersion,
              loader: loader || undefined
            });
          }

          if (compatibleVersionsCheck.length === 0) {
            await showModernAlert('Versión no compatible', `No se encontró una versión compatible para ${mcVersion} y ${loader || 'cualquier loader'}. Por favor selecciona combinaciones diferentes.`, 'warning');
            return;
          }
        } else {
          // Validaciones completas solo si no hay targetPath desde el modal
          if (selectedInstanceId && selectedInstanceId !== 'custom') {
            if (selectedContent && installedContent.has(`${selectedInstanceId}-${selectedContent.id}`)) {
              await showModernAlert('Ya instalado', `El contenido "${item.title}" ya está instalado en la instancia seleccionada.`, 'info');
              return;
            }
          }

          if (!mcVersion || mcVersion === 'all' || mcVersion === '') {
            await showModernAlert('Campo requerido', 'Por favor, selecciona una versión de Minecraft.', 'warning');
            return;
          }

          if ((contentType === 'mod' || contentType === 'modpack') && !loader) {
            await showModernAlert('Campo requerido', 'Por favor, selecciona un loader compatible.', 'warning');
            return;
          }

          let compatibleVersionsCheck: any[] = [];
          if (selectedPlatform === 'modrinth' && window.api.modrinth.getCompatibleVersions) {
            compatibleVersionsCheck = await window.api.modrinth.getCompatibleVersions({
              projectId: item.id,
              mcVersion: mcVersion,
              loader: loader || undefined
            });
          } else if (selectedPlatform === 'curseforge' && window.api.curseforge.getCompatibleVersions) {
            compatibleVersionsCheck = await window.api.curseforge.getCompatibleVersions({
              projectId: item.id,
              mcVersion: mcVersion,
              loader: loader || undefined
            });
          }

          if (compatibleVersionsCheck.length === 0) {
            await showModernAlert('Versión no compatible', `No se encontró una versión compatible para ${mcVersion} y ${loader || 'cualquier loader'}. Por favor selecciona combinaciones diferentes.`, 'warning');
            return;
          }

          if (contentType === 'modpack') {
            let hasSpecificVersion = false;
            if (selectedPlatform === 'modrinth') {
              hasSpecificVersion = compatibleVersionsCheck.some(version =>
                version.game_versions.includes(mcVersion) &&
                (!loader || version.loaders.includes(loader))
              );
            } else if (selectedPlatform === 'curseforge') {
              hasSpecificVersion = compatibleVersionsCheck.length > 0;
            }

            if (!hasSpecificVersion) {
              await showModernAlert('Versión no compatible', `El modpack no tiene una versión compatible para ${mcVersion} y ${loader || 'cualquier loader'}. Por favor selecciona combinaciones diferentes.`, 'warning');
              return;
            }
          }
        }

        let instancePath = '';
        
        // Si hay un targetPath desde el modal, usarlo directamente sin validar instancias
        if (hasTargetPath) {
          instancePath = targetPathParam!;
        } else if (selectedInstanceId === 'custom') {
          if (customFolderPath) {
            instancePath = customFolderPath;
          } else {
            alert('Por favor, selecciona una carpeta personalizada.');
            return;
          }
        } else {
          const selectedInstance = instances.find(instance => instance.id === selectedInstanceId);
          if (selectedInstance) {
            instancePath = selectedInstance.path;
          }
        }

        // Solo validar si no hay targetPath desde el modal
        if (!instancePath && !hasTargetPath) {
          alert('No se pudo encontrar la instancia seleccionada.');
          return;
        }

        const versionToUse = mcVersion && mcVersion !== 'all' && mcVersion !== '' ? mcVersion : item.minecraftVersions[0] || '1.20.1';
        const requiresLoader = contentType === 'mod' || contentType === 'modpack';
        const loaderToUse = requiresLoader && loader ? loader : undefined;

        // Crear entrada en downloadService para rastrear la descarga
        const downloadId = `content-${item.id}-${Date.now()}`;
        const startTime = Date.now();
        downloadService.addDownloadToHistory({
          id: downloadId,
          name: item.title,
          url: `content://${item.platform}/${item.id}`,
          status: 'downloading',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 1000000, // Valor estimado
          startTime: startTime,
          speed: 0,
          path: instancePath,
          profileUsername: undefined
        });

        const progressInterval = setInterval(() => {
          setInstallationProgress(prev => {
            const newProgress = prev >= 95 ? 95 : prev + 1;
            // Actualizar progreso en downloadService
            const currentDownload = downloadService.getAllDownloads().find(d => d.id === downloadId);
            if (currentDownload) {
              downloadService.addDownloadToHistory({
                ...currentDownload,
                progress: newProgress,
                downloadedBytes: Math.round((newProgress / 100) * (currentDownload.totalBytes || 1000000))
              });
            }
            return newProgress;
          });
        }, 200);

        try {
          await window.api.instances.installContent({
            instancePath: instancePath,
            contentId: item.id,
            contentType: contentType,
            mcVersion: versionToUse,
            loader: loaderToUse,
            versionId: undefined
          });

          if (selectedInstanceId !== 'custom') {
            setInstalledContent(prev => new Set(prev).add(`${selectedInstanceId}-${item.id}`));
          }

          setInstallationProgress(100);
          clearInterval(progressInterval);
          
          // Marcar como completada en downloadService
          downloadService.addDownloadToHistory({
            id: downloadId,
            name: item.title,
            url: `content://${item.platform}/${item.id}`,
            status: 'completed',
            progress: 100,
            downloadedBytes: 1000000,
            totalBytes: 1000000,
            startTime: startTime,
            endTime: Date.now(),
            speed: 0,
            path: instancePath,
            profileUsername: undefined
          });
          
          await new Promise(resolve => setTimeout(resolve, 300));

          await showModernAlert('¡Contenido instalado!', `${item.title} ha sido instalado en la ubicación seleccionada.`, 'success');
        } catch (error) {
          clearInterval(progressInterval);
          setInstallationProgress(0);
          
          // Marcar como error en downloadService
          downloadService.addDownloadToHistory({
            id: downloadId,
            name: item.title,
            url: `content://${item.platform}/${item.id}`,
            status: 'error',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            startTime: startTime,
            endTime: Date.now(),
            speed: 0,
            path: instancePath,
            profileUsername: undefined
          });
          
          throw error;
        }
      }
    } catch (error) {
      console.error('Error al manejar el contenido:', error);
      await showModernAlert('Error', error instanceof Error ? error.message : 'Error desconocido', 'error');
    } finally {
      setIsDownloading(prev => ({ ...prev, [item.id]: false }));
      setInstallationProgress(0);
    }
  };

  const handleDownloadAndInstall = async (item: ContentItem) => {
    setIsDownloading(prev => ({ ...prev, [item.id]: true }));
    setInstallationProgress(0); // Resetear progreso de instalación

    try {
      // Determinar el tipo de contenido correcto
      let contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'modpack';

      switch (item.type) {
        case 'resourcepacks':
          contentType = 'resourcepack';
          break;
        case 'shaders':
          contentType = 'shader';
          break;
        case 'datapacks':
          contentType = 'datapack';
          break;
        case 'modpacks':
          contentType = 'modpack';
          break;
        default: // 'mods' y otros tipos
          contentType = 'mod';
      }

      if (!selectedInstanceId) {
        // Si no se seleccionó instancia, preguntar al usuario qué quiere hacer
        const userChoice = await showModernConfirm(
          'Sin instancia seleccionada',
          `No has seleccionado una instancia.\n¿Quieres descargar "${item.title}" directamente a la zona de descargas?\n\nCancela para seleccionar una instancia en su lugar.`,
          'info'
        );

        if (!userChoice) {
          await showModernAlert('Información', 'Por favor, selecciona una instancia para instalar el contenido.', 'info');
          return;
        }

        // Obtener información de la versión compatible para descargar, dependiendo de la plataforma
        let compatibleVersions: any[] = [];
        if (selectedPlatform === 'modrinth') {
          compatibleVersions = await window.api.modrinth.getCompatibleVersions({
            projectId: item.id,
            mcVersion: selectedVersion !== 'all' ? selectedVersion : item.minecraftVersions[0] || '1.20.1'
          });
        } else if (selectedPlatform === 'curseforge') {
          compatibleVersions = await window.api.curseforge.getCompatibleVersions({
            projectId: item.id,
            mcVersion: selectedVersion !== 'all' ? selectedVersion : item.minecraftVersions[0] || '1.20.1'
          });
        }

        if (compatibleVersions.length === 0) {
          alert('No se encontraron versiones compatibles para descargar');
          return;
        }

        // Tomar la primera versión compatible
        const targetVersion = compatibleVersions[0];
        let primaryFile: any = null;

        if (selectedPlatform === 'modrinth') {
          primaryFile = targetVersion.files.find((f: any) => f.primary) || targetVersion.files[0];
        } else if (selectedPlatform === 'curseforge') {
          // Para CurseForge, la estructura puede ser diferente - buscar el archivo en la estructura de CurseForge
          primaryFile = targetVersion.files ? targetVersion.files[0] : null;
        }

        if (!primaryFile) {
          alert('No se encontraron archivos para descargar');
          return;
        }

        // Registrar en el sistema de descargas - el servicio crea su propio ID y lo usa
        downloadService.downloadFile(
          primaryFile.url || primaryFile.downloadUrl,
          primaryFile.filename || primaryFile.fileName,
          item.title
        );

        alert(`¡Contenido iniciado para descarga!\n${item.title} se está descargando en la zona de descargas.`);
      } else {
        // Validación de campos obligatorios para instancias
        if (selectedInstanceId && selectedInstanceId !== 'custom') {
          // Verificar si ya está instalado
          if (selectedContent && installedContent.has(`${selectedInstanceId}-${selectedContent.id}`)) {
            alert(`El contenido "${item.title}" ya está instalado en la instancia seleccionada.`);
            return;
          }

          // Validar que se haya seleccionado una versión
          // Usar detailVersion si está disponible (vista de detalle), de lo contrario usar el general
          const versionToUse = detailVersion || selectedVersion;
          if (!versionToUse || versionToUse === 'all' || versionToUse === '') {
            await showModernAlert('Campo requerido', 'Por favor, selecciona una versión de Minecraft.', 'warning');
            return;
          }

          // Validar que se haya seleccionado un loader si es necesario
          // Usar detailLoader si está disponible (vista de detalle), de lo contrario usar el general
          const loaderToUse = detailLoader || selectedLoader;
          if ((contentType === 'mod' || contentType === 'modpack') && !loaderToUse) {
            await showModernAlert('Campo requerido', 'Por favor, selecciona un loader compatible.', 'warning');
            return;
          }

          // Verificar si la combinación de versión y loader es compatible con el contenido, según la plataforma
          let compatibleVersionsCheck: any[] = [];
          if (selectedPlatform === 'modrinth' && window.api.modrinth.getCompatibleVersions) {
            compatibleVersionsCheck = await window.api.modrinth.getCompatibleVersions({
              projectId: item.id,
              mcVersion: versionToUse,
              loader: loaderToUse || undefined
            });
          } else if (selectedPlatform === 'curseforge' && window.api.curseforge.getCompatibleVersions) {
            compatibleVersionsCheck = await window.api.curseforge.getCompatibleVersions({
              projectId: item.id,
              mcVersion: versionToUse,
              loader: loaderToUse || undefined
            });
          }

          if (compatibleVersionsCheck.length === 0) {
            alert(`No se encontró una versión compatible para ${selectedVersion} y ${selectedLoader || 'cualquier loader'}. Por favor selecciona combinaciones diferentes.`);
            return;
          }

          // Para modpacks, verificar también si tiene versiones específicas disponibles
          if (contentType === 'modpack') {
            let hasSpecificVersion = false;
            if (selectedPlatform === 'modrinth') {
              hasSpecificVersion = compatibleVersionsCheck.some(version =>
                version.game_versions.includes(selectedVersion) &&
                (!selectedLoader || version.loaders.includes(selectedLoader))
              );
            } else if (selectedPlatform === 'curseforge') {
              // Para CurseForge, la verificación puede ser diferente
              hasSpecificVersion = compatibleVersionsCheck.length > 0;
            }

            if (!hasSpecificVersion) {
              alert(`El modpack no tiene una versión compatible para ${selectedVersion} y ${selectedLoader || 'cualquier loader'}. Por favor selecciona combinaciones diferentes.`);
              return;
            }
          }
        }

        // Instalar en la instancia como antes
        // Obtener la ruta de la instancia seleccionada
        let instancePath = '';
        if (selectedInstanceId === 'custom') {
          // Usar la ruta personalizada del estado
          if (customFolderPath) {
            instancePath = customFolderPath;
          } else {
            alert('Por favor, selecciona una carpeta personalizada.');
            return;
          }
        } else {
          const selectedInstance = instances.find(instance => instance.id === selectedInstanceId);
          if (selectedInstance) {
            instancePath = selectedInstance.path;
          }
        }

        if (!instancePath) {
          alert('No se pudo encontrar la instancia seleccionada.');
          return;
        }

        // Usar el nuevo sistema de instalación con versión y loader
        const mcVersion = selectedVersion && selectedVersion !== 'all' && selectedVersion !== '' ? selectedVersion : item.minecraftVersions[0] || '1.20.1';

        // Determinar si es un mod que requiere loader
        const requiresLoader = contentType === 'mod' || contentType === 'modpack';
        // Usar el loader seleccionado
        const loaderToUse = requiresLoader && selectedLoader ? selectedLoader : undefined;

        // Iniciar simulación de progreso de instalación
        const progressInterval = setInterval(() => {
          setInstallationProgress(prev => {
            if (prev >= 95) {
              clearInterval(progressInterval);
              return 95; // No llegar al 100% hasta que realmente termine
            }
            return prev + 1;
          });
        }, 200); // Actualizar cada 200ms

        try {
          await window.api.instances.installContent({
            instancePath: instancePath, // Usar la ruta de la instancia seleccionada
            contentId: item.id,
            contentType: contentType,
            mcVersion,
            loader: loaderToUse,
            versionId: undefined // En una implementación completa, se usaría la versión específica del contenido
          });

          // Marcar como instalado en la instancia solo si es una instancia real, no carpeta personalizada
          if (selectedInstanceId !== 'custom') {
            setInstalledContent(prev => new Set(prev).add(`${selectedInstanceId}-${item.id}`));
          }

          // Completar el progreso
          setInstallationProgress(100);
          clearInterval(progressInterval);

          // Pequeña pausa para que se vea el 100%
          await new Promise(resolve => setTimeout(resolve, 300));

          await showModernAlert('¡Contenido instalado!', `${item.title} ha sido instalado en la ubicación seleccionada.`, 'success');
        } catch (error) {
          clearInterval(progressInterval);
          setInstallationProgress(0);
          throw error; // Re-lanzar para que sea capturado por el catch general
        }
      }
    } catch (error) {
      console.error('Error al manejar el contenido:', error);
      await showModernAlert('Error', error instanceof Error ? error.message : 'Error desconocido', 'error');
    } finally {
      setIsDownloading(prev => ({ ...prev, [item.id]: false }));
      setInstallationProgress(0); // Resetear progreso de instalación
    }
  };

  // Get unique versions and categories for filters
  const versions = ['all', ...Array.from(new Set(content.flatMap(item => item.minecraftVersions)))];
  const categories = ['all', ...Array.from(new Set(content.flatMap(item => item.categories)))];

  // Modern scrollbar styles
  const scrollbarStyles = `
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  `;

  useEffect(() => {
    const unsubscribe = downloadService.subscribe(downloads => {
      // Usar setTimeout para evitar actualizar durante el renderizado
      setTimeout(() => {
        const newProgress: { [key: string]: number } = {};
        const newDownloading: { [key: string]: boolean } = {};
        
        downloads.forEach(download => {
          newProgress[download.id] = download.progress;
          if (download.status === 'downloading' || download.status === 'pending') {
            newDownloading[download.id] = true;
          }
        });

        setDownloadProgress(newProgress);
        setIsDownloading(newDownloading);
      }, 0);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      
      {/* Content Type Tabs */}
      <div className="relative mb-6" data-tutorial="content-tabs">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-2xl -z-10 blur-xl opacity-50"></div>
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
          {['modpacks', 'mods', 'resourcepacks', 'datapacks', 'shaders'].map((tab) => (
            <button
              key={tab}
              onClick={() => navigate(`/contenido/${tab}`)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-300 whitespace-nowrap relative overflow-hidden group ${
                type === tab
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700/80 hover:text-white'
              }`}
            >
              <span className="relative z-10">
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('packs', ' Packs').replace('mods', 'Mods')}
              </span>
              <span className={`absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 transition-opacity duration-300 ${
                type === tab ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}></span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - Filters */}
        {!selectedContent && (
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50 shadow-lg">
            {/* Platform Selection Buttons - Inside the Filter Box */}
            <div className="flex flex-col items-center gap-3 mb-6 overflow-x-auto pb-2 relative" data-tutorial="content-platforms">
              {(['modrinth', 'curseforge'] as Platform[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => setSelectedPlatform(platform)}
                  className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all duration-300 relative overflow-hidden group w-full ${
                    selectedPlatform === platform
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700/80 hover:text-white'
                  }`}
                >
                  <span className="flex items-center justify-center relative z-10 w-full">
                    {platform === 'modrinth' ? (
                      <img
                        src="https://cdn.modrinth.com/static/logo-cubeonly.5f38e9dd.png"
                        alt="Modrinth"
                        className="w-5 h-5 mr-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = 'https://modrinth.com/favicon.ico';
                        }}
                      />
                    ) : (
                      <img
                        src="https://www.curseforge.com/favicon.ico"
                        alt="CurseForge"
                        className="w-5 h-5 mr-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    {platform === 'modrinth' ? 'Modrinth' : 'CurseForge'}
                  </span>
                </button>
              ))}
              {/* Help Tooltip */}
              <div className="absolute top-0 right-0">
                <Tooltip
                  content={`Guía de instalación:\n\n1. Selecciona una plataforma (Modrinth o CurseForge)\n2. Elige el tipo de contenido\n3. Usa los filtros para encontrar lo que necesitas\n4. Haz clic en \"Detalles\" para ver información adicional\n5. Haz clic en \"Descargar\" para iniciar el proceso\n6. En la ventana modal, selecciona la versión y destino\n7. Confirma la descarga`}
                  position="left"
                >
                  <button className="text-gray-400 hover:text-white p-1 rounded-full bg-gray-700/50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
            </h3>
            
            {/* Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
              <div className="relative" data-tutorial="content-search">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar contenido..."
                  value={tempSearchQuery}
                  onChange={(e) => setTempSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearchQuery(tempSearchQuery);
                    }
                  }}
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* Sort By */}
            <div data-tutorial="content-sort">
              <label className="block text-sm font-medium text-gray-300 mb-2">Ordenar por</label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="appearance-none w-full bg-gray-700/50 border border-gray-600 rounded-xl text-white pl-3 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="popular">Más populares</option>
                  <option value="recent">Más recientes</option>
                  <option value="name">Por nombre (A-Z)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Main Content */}
        <div className="flex-1 relative">
          {/* Download Progress Widget and History Button - Positioned at top-right of content area */}
          <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
            <button
              onClick={() => setShowDownloadHistoryModal(true)}
              className="relative w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg flex items-center justify-center hover:from-purple-700 hover:to-pink-700 transition-all duration-300 group"
              title="Historial de Descargas"
            >
              <svg 
                className="w-6 h-6 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <button
              onClick={() => setShowMultipleDownloadQueue(true)}
              className="relative w-12 h-12 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg flex items-center justify-center hover:from-green-700 hover:to-emerald-700 transition-all duration-300 group"
              title="Iniciar Descargas Múltiples"
            >
              <svg 
                className="w-6 h-6 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
            <ContentDownloadProgressWidget 
              position="top-right" 
              onShowHistory={() => setShowDownloadHistoryModal(true)}
            />
          </div>
        {selectedContent ? (
          // Detail View
          <div className="bg-gray-800/50 rounded-xl p-6 mt-16">
            <button 
              onClick={handleBackToList}
              className="mb-4 flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver a la lista
            </button>
            
            {/* Contenido principal en una sola columna para que la información esté arriba y las pestañas abajo */}
            <div className="space-y-6">
              {/* Información principal del complemento - Fuera del recuadro de pestañas y arriba de ellas */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl">
                <div className="md:flex">
                  <div className="md:w-1/3">
                    <img
                      src={selectedContent.imageUrl}
                      alt={selectedContent.title}
                      className="w-full h-64 md:h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWYyOTM3Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzljYTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1pbmVjcmFmdDwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  </div>
                  <div className="md:w-2/3 p-6">
                    <h2 className="text-3xl font-bold text-white mb-2">{selectedContent.title}</h2>
                    <p className="text-blue-400 mb-4">por {selectedContent.author}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedContent.categories.slice(0, 5).map((category, index) => (
                        <span key={`${category}-${index}-${selectedContent.id}`} className="bg-blue-500/20 text-blue-300 text-sm px-3 py-1 rounded-full">
                          {category}
                        </span>
                      ))}
                      {selectedContent.categories.length > 5 && (
                        <span className="bg-gray-600/30 text-gray-400 text-sm px-3 py-1 rounded-full">
                          +{selectedContent.categories.length - 5}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-gray-400">Versión</p>
                        <p className="text-white font-medium">{selectedContent.version}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Actualizado</p>
                        <p className="text-white font-medium">{new Date(selectedContent.lastUpdated).toLocaleDateString('es-ES')}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Descargas</p>
                        <p className="text-white font-medium">{selectedContent.downloads.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Plataforma</p>
                        <p className="text-purple-400 font-medium capitalize">{selectedContent.platform}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-300 mb-2">Loaders Compatibles</h4>
                        <div className="flex flex-wrap gap-2">
                          {compatibleLoaders.slice(0, 6).map((loader, index) => (
                            <span key={`${loader}-${index}`} className={`px-3 py-1.5 rounded-full text-sm ${
                              selectedContent.platform === 'modrinth'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {loader.charAt(0).toUpperCase() + loader.slice(1)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-300 mb-2">Versiones de Minecraft</h4>
                        <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                          {selectedContent.minecraftVersions.slice(0, 10).map((version, index) => (
                            <span key={index} className="bg-gray-700/40 text-gray-300 px-2 py-1 rounded-lg text-sm border border-gray-600/30">
                              {version}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* Pestañas abajo de la información principal */}
              <div className="mt-6">
                <ModernContentDetail
                  selectedContent={selectedContent}
                />
              </div>
            </div>
          </div>
        ) : (
          // List View
          <div className="w-full mt-16">
            {filteredContent.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-white">No se encontraron resultados</h3>
                <p className="mt-1 text-gray-400">Intenta con otros filtros o términos de búsqueda.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setTempSearchQuery('');
                    setSelectedVersion('all');
                    setSelectedCategory('all');
                  }}
                  className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="w-full">
                {/* Controles de paginación */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                  <div className="text-sm text-gray-400">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredContent.length)} de {filteredContent.length} resultados
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={prevPage}
                      disabled={currentPage === 1}
                      className={`px-3 py-1.5 rounded-lg ${currentPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    >
                      Anterior
                    </button>

                    {/* Mostrar números de página con puntos suspensivos si hay muchas páginas */}
                    <div className="flex gap-1">
                      {totalPages <= 7 ? (
                        // Si hay 7 páginas o menos, mostrar todas
                        Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => goToPage(page)}
                            className={`w-10 h-10 rounded-full ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                          >
                            {page}
                          </button>
                        ))
                      ) : (
                        // Si hay más de 7 páginas, mostrar patrón con puntos suspensivos
                        (() => {
                          const pages = [];
                          const startPage = Math.max(1, currentPage - 2);
                          const endPage = Math.min(totalPages, currentPage + 2);

                          if (startPage > 1) {
                            pages.push(1);
                            if (startPage > 2) pages.push(-1); // Representa "..."
                          }

                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(i);
                          }

                          if (endPage < totalPages) {
                            if (endPage < totalPages - 1) pages.push(-1); // Representa "..."
                            pages.push(totalPages);
                          }

                          return pages.map((page, index) => (
                            page === -1 ? (
                              <span key={`dots-${index}`} className="w-10 h-10 flex items-center justify-center text-white">...</span>
                            ) : (
                              <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className={`w-10 h-10 rounded-full ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                              >
                                {page}
                              </button>
                            )
                          ));
                        })()
                      )}
                    </div>

                    <button
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1.5 rounded-lg ${currentPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>

                {/* Contenido paginado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedContent.map((item) => (
                    <ContentCard
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      description={item.description}
                      author={item.author}
                      downloads={item.downloads}
                      lastUpdated={item.lastUpdated}
                      imageUrl={item.imageUrl}
                      type={item.type}
                      platform={item.platform}
                      onDownload={() => handleDownload(item)}
                      onDetails={handleContentClick}
                      isDownloading={isDownloading[item.id]}
                      downloadProgress={downloadProgress[item.id]}
                    />
                  ))}
                </div>

                {/* Controles de paginación inferiores */}
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                  <div className="text-sm text-gray-400">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredContent.length)} de {filteredContent.length} resultados
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={prevPage}
                      disabled={currentPage === 1}
                      className={`px-3 py-1.5 rounded-lg ${currentPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    >
                      Anterior
                    </button>

                    <button
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1.5 rounded-lg ${currentPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Download Selection Modal */}
    <DownloadSelectionModal
      isOpen={showDownloadSelectionModal}
      onClose={() => setShowDownloadSelectionModal(false)}
      onSingleDownload={handleSingleDownload}
      onMultipleDownload={handleMultipleDownload}
    />

    {/* Single Download Modal */}
    {selectedDownloadItem && (
      <SingleDownloadModal
        isOpen={showSingleDownloadModal}
        onClose={() => setShowSingleDownloadModal(false)}
        contentItem={selectedDownloadItem}
        availableVersions={availableVersions}
        availableLoaders={availableLoaders}
        onDownloadStart={handleStartSingleDownload}
      />
    )}

    {/* Multiple Download Modal */}
    {selectedDownloadItem && (
      <MultipleDownloadModal
        isOpen={showMultipleDownloadModal}
        onClose={() => setShowMultipleDownloadModal(false)}
        contentItems={[selectedDownloadItem]} // Pasar como array
        availableVersions={availableVersions} // Pasar las versiones obtenidas para el item
        availableLoaders={availableLoaders} // Pasar los loaders obtenidos para el item
        onAddToQueue={handleAddToMultipleQueue}
      />
    )}

    {/* Multiple Download Queue */}
    <MultipleDownloadQueue
      isVisible={showMultipleDownloadQueue}
      onClose={() => setShowMultipleDownloadQueue(false)}
    />

    {/* Download Modals (originales) */}
    {selectedModalProject && (
      <DownloadModalModrinth
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        project={selectedModalProject}
        onDownloadComplete={() => console.log('Download completed')}
      />
    )}

    {selectedModalMod && (
      <DownloadModalCurseForge
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mod={selectedModalMod}
        onDownloadComplete={() => console.log('Download completed')}
      />
    )}

    {/* Download History Modal */}
    <DownloadHistoryModal
      isOpen={showDownloadHistoryModal}
      onClose={() => setShowDownloadHistoryModal(false)}
    />

    {/* Tutorial Overlay */}
    <TutorialOverlay pageId="content" steps={contentTutorialSteps} />
  </div>
);
};

export default ContentPage;
