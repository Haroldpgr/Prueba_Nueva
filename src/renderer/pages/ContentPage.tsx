import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
  const [content, setContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<{[key: string]: boolean}>({});
  const [downloadProgress, setDownloadProgress] = useState<{[key: string]: number}>({});
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

  // Cargar contenido desde Modrinth
  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      try {
        console.log(`Buscando ${type} en Modrinth con término:`, searchQuery);
        const results = await window.api.modrinth.search({
          contentType: type as ContentType,
          search: searchQuery
        });
        console.log('Resultados de Modrinth:', results);
        setContent(results);
      } catch (error) {
        console.error('Error al obtener datos de Modrinth:', error);
        // Mostrar mensaje de error al usuario
        alert('No se pudieron cargar los datos de Modrinth. Por favor, verifica tu conexión e inténtalo de nuevo.');
        setContent([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceLoad = setTimeout(() => {
      loadContent();
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

  // Set selected content when ID changes
  useEffect(() => {
    if (id) {
      const item = content.find(item => item.id === id);
      setSelectedContent(item || null);
    } else {
      setSelectedContent(null);
    }
  }, [id, content]);

  const handleContentClick = (item: ContentItem) => {
    navigate(`/contenido/${type}/${item.id}`);
  };

  const handleBackToList = () => {
    navigate(`/contenido/${type}`);
  };

  const handleDownload = async (item: ContentItem) => {
    if (!item.downloadUrl) {
      alert('Este contenido no tiene una URL de descarga directa disponible. Por favor, descárgalo manualmente desde el sitio web de Modrinth.');
      return;
    }

    setIsDownloading(prev => ({ ...prev, [item.id]: true }));
    setDownloadProgress(prev => ({ ...prev, [item.id]: 0 }));

    // Crear un nombre de archivo seguro
    const safeTitle = item.title
      .replace(/[^\w\s-]/g, '') // Eliminar caracteres no permitidos
      .replace(/\s+/g, '-')      // Reemplazar espacios con guiones
      .toLowerCase();
    
    const fileExtension = item.downloadUrl.split('.').pop() || 'zip';
    const filename = `${safeTitle}.${fileExtension}`;

    // Configurar manejadores de eventos
    const onProgress = (_event: any, data: { itemId: string; progress: number }) => {
      if (data.itemId === item.id) {
        setDownloadProgress(prev => ({
          ...prev,
          [item.id]: Math.round(data.progress * 100)
        }));
      }
    };

    const onComplete = (_event: any, data: { itemId: string; filePath: string }) => {
      if (data.itemId === item.id) {
        setIsDownloading(prev => ({ ...prev, [item.id]: false }));
        alert(`¡Descarga completada!\nArchivo guardado en: ${data.filePath}`);
      }
    };

    const onError = (_event: any, error: { itemId: string; message: string }) => {
      if (error.itemId === item.id) {
        setIsDownloading(prev => ({ ...prev, [item.id]: false }));
        alert(`Error en la descarga: ${error.message || 'Error desconocido'}`);
      }
    };

    // Registrar manejadores de eventos
    window.api.download.onProgress(onProgress);
    window.api.download.onComplete(onComplete);
    window.api.download.onError(onError);

    // Iniciar la descarga
    try {
      window.api.download.start({
        url: item.downloadUrl,
        filename,
        itemId: item.id
      });
    } catch (error) {
      console.error('Error al descargar el archivo:', error);
      setIsDownloading(prev => ({ ...prev, [item.id]: false }));
      alert('No se pudo iniciar la descarga. Por favor, verifica tu conexión e inténtalo de nuevo.');
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
                  
                  <button 
                    onClick={() => handleDownload(selectedContent)}
                    disabled={isDownloading[selectedContent.id]}
                    className={`w-full ${
                      isDownloading[selectedContent.id] 
                        ? 'bg-blue-700 cursor-wait' 
                        : 'bg-blue-600 hover:bg-blue-500'
                    } text-white py-2 px-4 rounded-lg font-medium transition-colors relative overflow-hidden`}
                  >
                    {isDownloading[selectedContent.id] ? (
                      <div className="flex items-center justify-center">
                        <span className="mr-2">
                          Descargando... {downloadProgress[selectedContent.id] || 0}%
                        </span>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      </div>
                    ) : (
                      'Descargar'
                    )}
                    {isDownloading[selectedContent.id] && (
                      <div 
                        className="absolute bottom-0 left-0 h-1 bg-blue-400 transition-all duration-200"
                        style={{ width: `${downloadProgress[selectedContent.id] || 0}%` }}
                      ></div>
                    )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredContent.map((item) => (
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
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default ContentPage;
