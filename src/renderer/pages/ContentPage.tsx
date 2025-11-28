import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { downloadService } from '../services/downloadService';

type ContentType = 'modpacks' | 'mods' | 'resourcepacks' | 'datapacks' | 'shaders';
type SortBy = 'popular' | 'recent' | 'name';

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
}


const ContentPage: React.FC = () => {
  const { type = 'modpacks', id } = useParams<{ type?: ContentType; id?: string }>();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [selectedLoader, setSelectedLoader] = useState<string>(''); // Nuevo estado para el loader
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
  const itemsPerPage = 20; // Mostrar 20 elementos por página

  // Cargar contenido desde Modrinth
  useEffect(() => {
    const loadInstancesAndContent = async () => {
      setIsLoading(true);
      try {
        // Cargar instancias del usuario
        if (window.api?.instances) {
          const userInstances = await window.api.instances.list();
          setInstances(userInstances);
        }

        // Cargar contenido desde Modrinth
        console.log(`Buscando ${type} en Modrinth con término:`, searchQuery);
        const results = await window.api.modrinth.search({
          contentType: type as ContentType,
          search: searchQuery
        });
        console.log('Resultados de Modrinth:', results);
        setContent(results);
        setCurrentPage(1); // Resetear a la primera página cuando se busca algo nuevo
      } catch (error) {
        console.error('Error al obtener datos:', error);
        // Mostrar mensaje de error al usuario
        if (error.message && error.message.includes('tiempo')) {
          alert('La solicitud ha tardado demasiado. Por favor, verifica tu conexión e inténtalo de nuevo.');
        } else {
          alert('No se pudieron cargar los datos. Por favor, verifica tu conexión e inténtalo de nuevo.');
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
  }, [type, searchQuery]);

  // Filter and sort content
  const filteredContent = React.useMemo(() => {
    let result = [...content];

    // Apply version filter
    if (selectedVersion !== 'all') {
      result = result.filter(item =>
        item.minecraftVersions.includes(selectedVersion)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      result = result.filter(item =>
        item.categories.includes(selectedCategory)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.downloads - a.downloads;
        case 'recent':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        case 'name':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [content, selectedVersion, selectedCategory, sortBy]);

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
    if (id) {
      const item = content.find(item => item.id === id);
      setSelectedContent(item || null);

      // Si se ha encontrado el contenido, cargar versiones y loaders compatibles
      if (item) {
        loadCompatibleVersionsAndLoaders(item);
      }
    } else {
      setSelectedContent(null);
      setCompatibleVersions([]);
      setCompatibleLoaders([]);
    }
  }, [id, content]);

  // Función para cargar versiones y loaders compatibles desde Modrinth
  const loadCompatibleVersionsAndLoaders = async (item: ContentItem) => {
    try {
      // Verificar si el método está disponible antes de usarlo
      if (window.api.modrinth.getCompatibleVersions) {
        // Obtener versiones compatibles desde Modrinth API
        // Usamos la primera versión compatible como referencia si no hay versión seleccionada
        const mcVersionForFilter = selectedVersion && selectedVersion !== 'all' ? selectedVersion : item.minecraftVersions[0] || '1.20.1';

        const compatibleVersions = await window.api.modrinth.getCompatibleVersions({
          projectId: item.id,
          mcVersion: mcVersionForFilter,
          loader: selectedLoader || undefined
        });

      // Extraer todas las versiones únicas de Minecraft de las versiones compatibles
      const allGameVersions = new Set<string>();
      compatibleVersions.forEach((version: any) => {
        version.game_versions.forEach((v: string) => allGameVersions.add(v));
      });

      // Filtrar y ordenar versiones como antes (descendente: la más nueva primero)
      const filteredVersions = Array.from(allGameVersions)
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

      // Extraer loaders compatibles
      const allLoaders = new Set<string>();
      compatibleVersions.forEach((version: any) => {
        version.loaders.forEach((l: string) => allLoaders.add(l));
      });

      const compatibleLoadersList = Array.from(allLoaders);
      setCompatibleLoaders(compatibleLoadersList);
    } else {
      // Fallback: usar las versiones originales del contenido del item
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

  const handleContentClick = (item: ContentItem) => {
    navigate(`/contenido/${type}/${item.id}`);
  };

  const handleBackToList = () => {
    navigate(`/contenido/${type}`);
  };

  const handleDownload = async (item: ContentItem) => {
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
        const userChoice = confirm(`No has seleccionado una instancia.\n¿Quieres descargar "${item.title}" directamente a la zona de descargas?\n\nCancela para seleccionar una instancia en su lugar.`);

        if (!userChoice) {
          alert('Por favor, selecciona una instancia para instalar el contenido.');
          return;
        }

        // Obtener información de la versión compatible para descargar
        const compatibleVersions = await window.api.modrinth.getCompatibleVersions({
          projectId: item.id,
          mcVersion: selectedVersion !== 'all' ? selectedVersion : item.minecraftVersions[0] || '1.20.1'
        });

        if (compatibleVersions.length === 0) {
          alert('No se encontraron versiones compatibles para descargar');
          return;
        }

        // Tomar la primera versión compatible
        const targetVersion = compatibleVersions[0];
        const primaryFile = targetVersion.files.find((f: any) => f.primary) || targetVersion.files[0];

        if (!primaryFile) {
          alert('No se encontraron archivos para descargar');
          return;
        }

        // Registrar en el sistema de descargas - el servicio crea su propio ID y lo usa
        downloadService.downloadFile(
          primaryFile.url,
          primaryFile.filename,
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
          if (!selectedVersion || selectedVersion === 'all') {
            alert('Por favor, selecciona una versión de Minecraft.');
            return;
          }

          // Validar que se haya seleccionado un loader si es necesario
          if ((contentType === 'mod' || contentType === 'modpack') && !selectedLoader) {
            alert('Por favor, selecciona un loader compatible.');
            return;
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

          alert(`¡Contenido instalado!\n${item.title} ha sido instalado en la ubicación seleccionada.`);
        } catch (error) {
          clearInterval(progressInterval);
          setInstallationProgress(0);
          throw error; // Re-lanzar para que sea capturado por el catch general
        }
      }
    } catch (error) {
      console.error('Error al manejar el contenido:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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

  // Efecto para escuchar eventos de descarga
  useEffect(() => {
    const handleDownloadProgress = (event: any, data: { itemId: string; progress: number }) => {
      setDownloadProgress(prev => ({
        ...prev,
        [data.itemId]: Math.round(data.progress * 100)
      }));
    };

    const handleDownloadComplete = (event: any, data: { itemId: string; filePath: string }) => {
      setIsDownloading(prev => ({
        ...prev,
        [data.itemId]: false
      }));
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[data.itemId];
        return newProgress;
      });
      // Si la descarga era para instalar en una instancia, marcar como instalado
      if (selectedInstanceId) {
        setInstalledContent(prev => new Set(prev).add(`${selectedInstanceId}-${data.itemId}`));
      }
    };

    const handleDownloadError = (event: any, error: { itemId: string; message: string }) => {
      setIsDownloading(prev => ({
        ...prev,
        [error.itemId]: false
      }));
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[error.itemId];
        return newProgress;
      });
    };

    // Registrar listeners
    window.api.download.onProgress(handleDownloadProgress);
    window.api.download.onComplete(handleDownloadComplete);
    window.api.download.onError(handleDownloadError);

    // Cleanup
    return () => {
      // No hay función de unsubscribe para estos listeners
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
      
      {/* Modern Navigation Tabs */}
      <div className="relative mb-8">
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
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
            </h3>
            
            {/* Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar contenido..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* Version Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Versión de Minecraft</label>
              <div className="relative">
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="appearance-none w-full bg-gray-700/50 border border-gray-600 rounded-xl text-white pl-3 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Todas las versiones</option>
                  {Array.from(new Set(content.flatMap(item => item.minecraftVersions))).map(version => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Sort By */}
            <div>
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
        <div className="flex-1">
        {selectedContent ? (
          // Detail View
          <div className="bg-gray-800/50 rounded-xl p-6">
            <button 
              onClick={handleBackToList}
              className="mb-4 flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver a la lista
            </button>
            
            <div className="md:flex gap-6">
              <div className="md:w-1/3">
                <img
                  src={selectedContent.imageUrl}
                  alt={selectedContent.title}
                  className="w-full rounded-lg shadow-lg mb-4"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/600x300/1f2937/9ca3af?text=Sin+imagen';
                  }}
                />
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <h2 className="text-xl font-bold text-white mb-2">{selectedContent.title}</h2>
                  <p className="text-gray-300 text-sm mb-4">por {selectedContent.author}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedContent.categories.map((category, index) => (
                      <span key={`${category}-${index}-${selectedContent.id}`} className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
                        {category}
                      </span>
                    ))}
                  </div>
                  
                  <div className="text-sm text-gray-400 mb-4">
                    <p><span className="font-medium">Versión:</span> {selectedContent.version}</p>
                    <p><span className="font-medium">Actualizado:</span> {new Date(selectedContent.lastUpdated).toLocaleDateString()}</p>
                    <p><span className="font-medium">Descargas:</span> {selectedContent.downloads.toLocaleString()}</p>
                    <p><span className="font-medium">Versiones de Minecraft:</span> {selectedContent.minecraftVersions.join(', ')}</p>
                  </div>

                  {/* Selector de versión, loader e instancia/carpeta encima del botón de descarga */}
                  <div className="space-y-3">
                    {/* Selector de versión */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Versión del contenido:
                      </label>
                      <div className="relative">
                        <select
                          value={selectedVersion || ''}
                          onChange={(e) => setSelectedVersion(e.target.value)}
                          className="w-full bg-gray-700/80 backdrop-blur-sm border border-gray-600 rounded-xl py-3 px-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 appearance-none"
                        >
                          <option value="">Selecciona una versión...</option>
                          {compatibleVersions.map(version => (
                            <option key={version} value={version}>
                              {version}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-300">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Selector de loader (solo para mods) */}
                    {(selectedContent?.type === 'modpacks' || selectedContent?.type === 'mods') ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">
                          Loader compatible:
                        </label>
                        <div className="relative">
                          <select
                            value={selectedLoader}
                            onChange={(e) => setSelectedLoader(e.target.value)}
                            className="w-full bg-gray-700/80 backdrop-blur-sm border border-gray-600 rounded-xl py-3 px-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 appearance-none"
                          >
                            <option value="">Selecciona un loader...</option>
                            {compatibleLoaders.includes('forge') && <option value="forge">Forge</option>}
                            {compatibleLoaders.includes('fabric') && <option value="fabric">Fabric</option>}
                            {compatibleLoaders.includes('quilt') && <option value="quilt">Quilt</option>}
                            {compatibleLoaders.includes('neoforge') && <option value="neoforge">NeoForge</option>}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Selector de instancia o carpeta personalizada */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Instancia de destino:
                      </label>
                      <div className="relative">
                        <select
                          value={selectedInstanceId}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSelectedInstanceId(value);
                            setShowCustomFolder(value === 'custom');
                          }}
                          className="w-full bg-gray-700/80 backdrop-blur-sm border border-gray-600 rounded-xl py-3 px-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 appearance-none"
                        >
                          <option value="">Seleccionar instancia...</option>
                          {instances.map(instance => (
                            <option key={instance.id} value={instance.id}>
                              {instance.name} ({instance.version}) {instance.loader && ` - ${instance.loader}`}
                            </option>
                          ))}
                          <option value="custom"> Carpeta personalizada...</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-300">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Opción para carpeta personalizada */}
                    {showCustomFolder && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">
                          Ruta personalizada:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customFolderPath}
                            onChange={(e) => setCustomFolderPath(e.target.value)}
                            placeholder="Selecciona una carpeta..."
                            className="flex-1 bg-gray-700/80 backdrop-blur-sm border border-gray-600 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                          />
                          <button
                            className="bg-gradient-to-r from-blue-600 to-primary hover:from-blue-700 hover:to-primary/90 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            onClick={async () => {
                              // Lógica para seleccionar carpeta personalizada
                              try {
                                // Verificar si existe la API de diálogo
                                if (window.api?.dialog?.showOpenDialog) {
                                  const result = await window.api.dialog.showOpenDialog({
                                    properties: ['openDirectory'],
                                    title: 'Seleccionar carpeta de destino',
                                    buttonLabel: 'Seleccionar'
                                  });
                                  if (!result.canceled && result.filePaths.length > 0) {
                                    // Actualizar el estado con la ruta seleccionada
                                    setCustomFolderPath(result.filePaths[0]);
                                  } else {
                                    console.log('Selección de carpeta cancelada o sin resultados');
                                  }
                                } else {
                                  // Si no está disponible, mostrar mensaje de error más descriptivo
                                  alert('La función de selección de carpetas no está disponible. Puede que necesites reconstruir la aplicación o verificar la instalación.');
                                }
                              } catch (error) {
                                console.error('Error al seleccionar carpeta:', error);
                                alert('Error al seleccionar la carpeta: ' + (error as Error).message);
                              }
                            }}
                          >
                            Explorar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownload(selectedContent)}
                    disabled={isDownloading[selectedContent.id]}
                    className="w-full relative overflow-hidden rounded-lg transition-all duration-300"
                  >
                    {/* Barra de progreso visual */}
                    <div
                      className={`absolute bottom-0 left-0 top-0 bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300 ease-out ${
                        isDownloading[selectedContent.id] ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{
                        width: `${downloadProgress[selectedContent.id] || 0}%`,
                        zIndex: 10,
                        opacity: isDownloading[selectedContent.id] ? 0.8 : 0
                      }}
                    ></div>

                    {/* Capa de fondo del botón */}
                    <div
                      className={`absolute inset-0 rounded-lg transition-all duration-300 ${
                        isDownloading[selectedContent.id]
                          ? 'bg-gray-800/80 backdrop-blur-sm'
                          : (selectedInstanceId && instances.some(instance =>
                              instance.id === selectedInstanceId &&
                              // Comprueba si el contenido ya está instalado en la instancia (verificación simplificada)
                              // En una implementación completa, esto se verificaría leyendo los archivos de la instancia
                              false
                            ))
                            ? 'bg-gradient-to-r from-green-600 to-green-700' // Verde si ya está instalado
                            : selectedInstanceId
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700'
                              : 'bg-gradient-to-r from-blue-600 to-primary'
                      }`}
                      style={{ zIndex: 1 }}
                    ></div>

                    {/* Contenido del botón */}
                    <div
                      className="relative z-20 py-2 px-4 font-medium text-white flex items-center justify-center"
                    >
                      {isDownloading[selectedContent.id] ? (
                        <div className="flex items-center justify-center">
                          <span className="mr-2">
                            {selectedInstanceId ? `Instalando... ${installationProgress}%` : `Descargando... ${downloadProgress[selectedContent.id] || 0}%`}
                          </span>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        </div>
                      ) : (
                        selectedInstanceId && selectedInstanceId !== 'custom' && selectedContent && installedContent.has(`${selectedInstanceId}-${selectedContent.id}`) ?
                        'Ya instalado en instancia' :
                        (selectedInstanceId ? (selectedInstanceId === 'custom' ? 'Instalar en Carpeta' : 'Instalar en Instancia') : 'Descargar')
                      )}
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="md:w-2/3 mt-6 md:mt-0">
                <div className="bg-gray-700/30 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Descripción</h3>
                  <p className="text-gray-300">{selectedContent.description}</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Instalación</h3>
                  <ol className="list-decimal list-inside text-gray-300 space-y-2">
                    <li>Descarga el archivo haciendo clic en el botón "Descargar"</li>
                    <li>Abre Minecraft y ve a "Opciones"</li>
                    <li>Selecciona "Paquetes de recursos" o "Mods" según corresponda</li>
                    <li>Arrastra y suelta el archivo descargado</li>
                    <li>Actívalo y haz clic en "Listo"</li>
                    <li>¡Disfruta de tu nuevo contenido!</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // List View
          <div className="w-full">
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
                    <div
                      key={item.id}
                      onClick={() => handleContentClick(item)}
                      className="bg-gray-700/50 rounded-xl overflow-hidden hover:bg-gray-700/70 transition-colors cursor-pointer group"
                    >
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://via.placeholder.com/600x300/1f2937/9ca3af?text=Sin+imagen';
                          }}
                        />
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {item.type}
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium text-white mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-2">{item.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {item.minecraftVersions.slice(0, 2).map((version, index) => (
                            <span key={`${version}-${index}-${item.id}`} className="bg-gray-600/50 text-gray-300 text-xs px-2 py-0.5 rounded">
                              {version}
                            </span>
                          ))}
                          {item.minecraftVersions.length > 2 && (
                            <span key={`more-${item.id}`} className="bg-gray-600/50 text-gray-300 text-xs px-2 py-0.5 rounded">
                              +{item.minecraftVersions.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
  </div>
);
};

export default ContentPage;
