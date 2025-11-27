import React, { useState, useRef, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { profileService } from '../services/profileService';

// Añadir estilos CSS para los scrolls personalizados
const customScrollStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(26, 32, 44, 0.5);
    border-radius: 4px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #4f46e5, #7c3aed);
    border-radius: 4px;
    transition: all 0.3s ease;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #6366f1, #8b5cf6);
  }

  /* Estilos para todos los scrolls en la página */
  .skin-page-container::-webkit-scrollbar {
    width: 10px;
  }

  .skin-page-container::-webkit-scrollbar-track {
    background: rgba(17, 24, 39, 0.3);
    border-radius: 6px;
  }

  .skin-page-container::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #4f46e5, #7c3aed);
    border-radius: 6px;
    border: 2px solid rgba(17, 24, 39, 0.3);
  }

  .skin-page-container::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #6366f1, #8b5cf6);
  }
`;

// Añadir los estilos al documento cuando el componente se monta
if (typeof document !== 'undefined') {
  let styleElement = document.getElementById('custom-scroll-skin-styles');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'custom-scroll-skin-styles';
    styleElement.textContent = customScrollStyles;
    document.head.appendChild(styleElement);
  }
}

interface Skin {
  id: string;
  name: string;
  url: string;
  previewUrl: string;
  isPublic: boolean;
}

const SkinsPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSkinUrl, setSelectedSkinUrl] = useState<string>('');
  const [skinPreview, setSkinPreview] = useState<string | null>(null);
  const [selectedPublicSkin, setSelectedPublicSkin] = useState<Skin | null>(null);
  const [skinCategory, setSkinCategory] = useState<'basic' | 'modern'>('basic');
  const [currentSkin, setCurrentSkin] = useState<string | null>(null);
  
  useEffect(() => {
    const currentUser = profileService.getCurrentProfile();
    if (currentUser) {
      const userSkin = profileService.getSkinForProfile(currentUser);
      setCurrentSkin(userSkin || 'https://mc-heads.net/body/steve.png');
    }
  }, []);

  const basicSkins: Skin[] = [
    {
      id: '1',
      name: 'Classic Steve',
      url: 'https://textures.minecraft.net/texture/1a4af718c7304bd2b886fcf43f887c4d0f6faceac8b4b3c3a0912b643a10235b',
      previewUrl: 'https://mc-heads.net/body/steve.png',
      isPublic: true
    },
    {
      id: '2',
      name: 'Classic Alex',
      url: 'https://textures.minecraft.net/texture/3f4f482e4a7a4c759d9c4a7a4c759d9c4a7a4c759d9c4a7a4c759d9c4a7a4c7',
      previewUrl: 'https://mc-heads.net/body/alex.png',
      isPublic: true
    },
    {
      id: '3',
      name: 'Simple Default',
      url: 'https://textures.minecraft.net/texture/8d4234a2c86e2329159cf1b5a79b4a7a4c759d9c4a7a4c759d9c4a7a4c759d9c',
      previewUrl: 'https://mc-heads.net/body/steve.png',
      isPublic: true
    }
  ];
  
  const modernSkins: Skin[] = [
    {
      id: '4',
      name: 'Desert Nomad',
      url: 'https://textures.minecraft.net/texture/71b6a1e6281f4c0d9a2a1a3e9d1f2c3b4a5e6f7d8e9f0a1b2c3d4e5f6a7b8c9',
      previewUrl: 'https://mc-heads.net/body/steve.png',
      isPublic: true
    },
    {
      id: '5',
      name: 'Forest Ranger',
      url: 'https://textures.minecraft.net/texture/8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7',
      previewUrl: 'https://mc-heads.net/body/alex.png',
      isPublic: true
    },
    {
      id: '6',
      name: 'Ocean Explorer',
      url: 'https://textures.minecraft.net/texture/9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8',
      previewUrl: 'https://mc-heads.net/body/steve.png',
      isPublic: true
    },
    {
      id: '7',
      name: 'Nether Knight',
      url: 'https://textures.minecraft.net/texture/7e6f5d4c3b2a1f9e8d7c6b5a4f3e2d1c9b8a7f6e5d4c3b2a1f9e8d7c6b5a4f3',
      previewUrl: 'https://mc-heads.net/body/steve.png',
      isPublic: true
    },
    {
      id: '8',
      name: 'Ender Mage',
      url: 'https://textures.minecraft.net/texture/6f5e4d3c2b1a9f8e7d6c5b4a3f2e1d9c8b7a6f5e4d3c2b1a9f8e7d6c5b4a3f2',
      previewUrl: 'https://mc-heads.net/body/alex.png',
      isPublic: true
    },
    {
      id: '9',
      name: 'Diamond Miner',
      url: 'https://textures.minecraft.net/texture/5e4d3c2b1a9f8e7d6c5b4a3f2e1d9c8b7a6f5e4d3c2b1a9f8e7d6c5b4a3f2e1',
      previewUrl: 'https://mc-heads.net/body/steve.png',
      isPublic: true
    }
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setSkinPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = () => {
    if (selectedSkinUrl) {
      setSkinPreview(selectedSkinUrl);
    }
  };

  const handleUsePublicSkin = (skin: Skin) => {
    setSelectedPublicSkin(skin);
    setSkinPreview(skin.previewUrl);
  };

  const handleSaveSkin = () => {
    const currentUser = profileService.getCurrentProfile();
    if (skinPreview && currentUser) {
      profileService.setSkinForProfile(currentUser, skinPreview);
      setCurrentSkin(skinPreview); // Actualizar la skin actual mostrada
      alert('¡Skin guardada exitosamente en tu perfil!');
    } else if (!currentUser) {
      alert('Por favor inicia sesión con un perfil antes de guardar una skin.');
    } else {
      alert('Por favor selecciona una skin antes de guardar.');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto skin-page-container">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 -z-10"></div>

      {/* Header moderno con efectos */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-2xl -z-10 blur-xl opacity-50"></div>
        <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-center md:text-left mb-2 md:mb-0">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
                Personaliza tu Skin
              </h1>
              <p className="text-gray-400">
                Elige y aplica tu skin personalizada
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
                  <span className="text-gray-300 text-sm">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Panel izquierdo: Carga de skins y skin actual */}
        <div className="lg:col-span-3 space-y-8">
          {/* Card de carga de skins */}
          <Card>
            <div className="p-8">
              <div className="flex items-center mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Cargar Skin Personalizada</h2>
              </div>
              
              <div className="space-y-6">
                {/* Botones de carga */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button 
                    variant="secondary" 
                    onClick={handleUploadClick}
                    className="flex-1 py-4 text-base flex items-center justify-center gap-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border border-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    Seleccionar desde PC
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  <Button 
                    variant="secondary" 
                    onClick={handleUrlChange}
                    className="flex-1 py-4 text-base flex items-center justify-center gap-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border border-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                    </svg>
                    Cargar desde URL
                  </Button>
                </div>
                
                {/* Campo de URL */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Pega la URL de tu skin aquí (formato .png)..."
                    value={selectedSkinUrl}
                    onChange={(e) => setSelectedSkinUrl(e.target.value)}
                    className="w-full bg-gray-800/70 border border-gray-700 rounded-xl text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                
                {/* Vista previa */}
                {skinPreview && (
                  <div className="mt-8">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg mr-3">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-white">Vista previa de la Skin</h3>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="relative inline-block mb-4">
                        <div className="bg-gray-800 border-4 border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                          <img 
                            src={skinPreview} 
                            alt="Vista previa de la skin" 
                            className="w-64 h-64 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://placehold.co/256x512/1f2937/9ca3af?text=Sin+Vista+Previa';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Botones de acción */}
                      <div className="flex gap-3 w-full max-w-xs">
                        <Button 
                          onClick={() => {
                            // Crear un enlace temporal para descargar la imagen
                            const link = document.createElement('a');
                            link.href = skinPreview;
                            link.download = 'skin-preview.png';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="flex-1 py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                          </svg>
                          Descargar
                        </Button>
                        
                        <Button 
                          variant="secondary"
                          onClick={() => {
                            // Abrir la imagen en una nueva pestaña para verla en tamaño completo
                            window.open(skinPreview, '_blank');
                          }}
                          className="py-2 px-4 flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Card de vista previa de la skin actual */}
          <Card>
            <div className="p-8">
              <div className="flex items-center mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Tu Skin Actual</h2>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative inline-block mb-4">
                  <div className="bg-gray-800 border-4 border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    <img
                      src={currentSkin}
                      alt="Tu skin actual"
                      className="w-64 h-64 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://mc-heads.net/body/steve.png';
                      }}
                    />
                  </div>
                </div>
                <p className="text-gray-400 text-center">
                  Esta es la skin que tienes actualmente en tu perfil
                </p>
              </div>
            </div>
          </Card>

          {/* Card de guardado */}
          <Card>
            <div className="p-8">
              <div className="flex items-center mb-6">
                <div className="p-3 bg-gradient-to-r from-green-600 to-teal-600 rounded-xl mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Aplicar Skin</h2>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-gray-400 mb-8 max-w-2xl text-center">
                  La skin seleccionada se guardará en tu perfil actual y se aplicará la próxima vez que inicies sesión en Minecraft.
                </p>
                <Button 
                  onClick={handleSaveSkin}
                  className="py-4 px-12 text-lg flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/30"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Guardar Skin en Perfil
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Panel derecho: Skins públicas y más */}
        <div className="space-y-8">
          {/* Skins populares */}
          <Card>
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white">Skins Populares</h2>
              </div>
              <p className="text-gray-400 mb-6 text-sm">
                Selecciona una skin popular para usar temporalmente o como inspiración.
              </p>
              
              {/* Selector de categoría */}
              <div className="flex mb-4 rounded-xl bg-gray-800/50 p-1">
                <button
                  className={`flex-1 py-2 px-4 rounded-lg text-center transition-all duration-300 ${
                    skinCategory === 'basic'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => setSkinCategory('basic')}
                >
                  Básicas
                </button>
                <button
                  className={`flex-1 py-2 px-4 rounded-lg text-center transition-all duration-300 ${
                    skinCategory === 'modern'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => setSkinCategory('modern')}
                >
                  Modernas
                </button>
              </div>
              
              {/* Lista de skins según categoría */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {(skinCategory === 'basic' ? basicSkins : modernSkins).map(skin => (
                  <div 
                    key={skin.id} 
                    className={`rounded-xl overflow-hidden border cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
                      selectedPublicSkin?.id === skin.id 
                        ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10' 
                        : 'border-gray-700 hover:border-gray-500 bg-gray-800/40'
                    }`}
                    onClick={() => handleUsePublicSkin(skin)}
                  >
                    <div className="p-3 flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <img 
                          src={skin.previewUrl} 
                          alt={skin.name} 
                          className="w-12 h-12 border border-gray-600 rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://placehold.co/48x48/1f2937/9ca3af?text=Skin';
                          }}
                        />
                        {selectedPublicSkin?.id === skin.id && (
                          <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-100 text-sm truncate">{skin.name}</h3>
                        <p className="text-xs text-gray-400">Clic para seleccionar</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          
          {/* Card de información y más skins */}
          <Card>
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white">Más Skins</h2>
              </div>
              
              <div className="space-y-3 text-gray-400 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Formato: <span className="text-gray-300 font-medium">.png</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Resolución: <span className="text-gray-300 font-medium">64x64 o 64x32</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Estilo: <span className="text-gray-300 font-medium">Steve o Alex</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p>Comunidad: <span className="text-gray-300 font-medium">Normas de Mojang</span></p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SkinsPage;