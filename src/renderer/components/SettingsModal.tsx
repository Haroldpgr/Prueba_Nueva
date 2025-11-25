import React, { useEffect, useState } from 'react'
import Card from './Card'
import Button from './Button'
import { Icon } from './Sidebar'
import Modal from './Modal'

type Tab = 'privacidad' | 'apariencia' | 'recursos' | 'java' | 'instancias'
type IconName = React.ComponentProps<typeof Icon>['name']

const TabButton = ({ isActive, onClick, children, icon }: { isActive: boolean, onClick: () => void, children: React.ReactNode, icon: IconName }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-200 flex items-center gap-3 text-sm ${isActive ? 'bg-primary text-black' : 'text-gray-300 hover:bg-gray-800/50'}`}
  >
    <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
      <Icon name={icon} />
    </div>
    <span className="font-medium">{children}</span>
  </button>
)

const Toggle = ({ label, enabled, onToggle, description }: { label: string, enabled: boolean, onToggle: (e: boolean) => void, description?: string }) => (
  <label className="flex flex-col cursor-pointer">
    <div className="flex items-center justify-between mb-2">
      <div className="font-semibold text-sm text-gray-100">{label}</div>
      <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${enabled ? 'bg-primary' : 'bg-gray-700'}`}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${enabled ? 'transform translate-x-5' : ''}`} />
        <input type="checkbox" className="absolute opacity-0 w-full h-full cursor-pointer" checked={enabled} onChange={e => onToggle(e.target.checked)} />
      </div>
    </div>
    {description && <div className="text-xs text-gray-400 pl-2">{description}</div>}
  </label>
)

const SettingsInput = ({ label, ...props }: { label: string } & React.ComponentProps<'input'>) => (
  <label className="block">
    <span className="text-sm font-medium text-gray-400">{label}</span>
    <input {...props} className="mt-1 bg-gray-950 p-1.5 rounded-lg w-full border border-gray-800 focus:ring-2 focus:ring-primary focus:border-primary" />
  </label>
)

const SettingsSelect = ({ label, children, ...props }: { label: string, children: React.ReactNode } & React.ComponentProps<'select'>) => (
  <label className="block">
    <span className="text-sm font-medium text-gray-400">{label}</span>
    <select {...props} className="mt-1 bg-gray-950 p-1.5 rounded-lg w-full border border-gray-800 focus:ring-2 focus:ring-primary focus:border-primary">
      {children}
    </select>
  </label>
)

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  onSettingsChanged?: (settings: any) => void
}

export default function SettingsModal({ isOpen, onClose, onSettingsChanged }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('privacidad');

  // Settings state
  const [javaPath, setJavaPath] = useState('');
  const [defaultRamMb, setDefaultRamMb] = useState(4096);
  const [theme, setTheme] = useState<'dark' | 'light' | 'oled'>('dark');
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [instancesBase, setInstancesBase] = useState('');
  const [sendCrashReports, setSendCrashReports] = useState(true);
  const [sendAnalytics, setSendAnalytics] = useState(true);
  const [personalizedAds, setPersonalizedAds] = useState(true);
  const [telemetry, setTelemetry] = useState(true);
  const [discordRPC, setDiscordRPC] = useState(true);
  const [defaultLandingPage, setDefaultLandingPage] = useState<'home' | 'recent-worlds' | 'instances' | 'servers'>('home');
  const [jumpBackToWorlds, setJumpBackToWorlds] = useState(true);
  const [advancedRendering, setAdvancedRendering] = useState({
    renderDistance: 8,
    graphics: 'fancy' as 'fast' | 'fancy',
    particles: 'all' as 'minimal' | 'decreased' | 'all',
    smoothLighting: 2
  });

  useEffect(() => {
    if (!isOpen) return;
    window.api.settings.get().then(s => {
      setJavaPath(s.javaPath || '');
      setDefaultRamMb(s.defaultRamMb || 4096);
      setTheme(s.theme || 'dark');
      setLanguage(s.language || 'es');
      setInstancesBase(s.instancesBase || '');
      setPersonalizedAds(s.personalizedAds !== undefined ? s.personalizedAds : true);
      setTelemetry(s.telemetry !== undefined ? s.telemetry : true);
      setDiscordRPC(s.discordRPC !== undefined ? s.discordRPC : true);
      setDefaultLandingPage(s.defaultLandingPage || 'home');
      setJumpBackToWorlds(s.jumpBackToWorlds !== undefined ? s.jumpBackToWorlds : true);
      setAdvancedRendering(s.advancedRendering || {
        renderDistance: 8,
        graphics: 'fancy',
        particles: 'all',
        smoothLighting: 2
      });
    })
  }, [isOpen])

  const handleSave = async () => {
    const settingsToSave = {
      javaPath,
      defaultRamMb,
      theme,
      language,
      instancesBase,
      personalizedAds,
      telemetry,
      discordRPC,
      defaultLandingPage,
      jumpBackToWorlds,
      advancedRendering
    };

    await window.api.settings.set(settingsToSave);

    // Llamar al callback si existe
    if (onSettingsChanged) {
      onSettingsChanged(settingsToSave);
    }

    onClose(); // Close modal after saving
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'privacidad':
        return (
          <div className="space-y-5">
            <div className="mb-1">
              <h2 className="text-xl font-bold text-gray-100">Privacidad</h2>
              <p className="text-sm text-gray-400 mt-1">Controla tu privacidad y las funciones relacionadas</p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 transition-all duration-300 hover:border-gray-600/50">
              <div className="flex items-center mb-4">
                <div className="mr-3 p-2 bg-primary/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-200">Preferencias de Privacidad</h3>
              </div>
              <div className="space-y-4">
                <Toggle
                  label="Anuncios personalizados"
                  enabled={personalizedAds}
                  onToggle={setPersonalizedAds}
                  description="El proveedor de anuncios del launcher muestra anuncios basados en las preferencias del usuario. Si esta opción está desactivada, no se mostrarán anuncios personalizados basados en los intereses del usuario."
                />
                <Toggle
                  label="Telemetría"
                  enabled={telemetry}
                  onToggle={setTelemetry}
                  description="El launcher recopila datos anónimos de uso y estadísticas para mejorar la experiencia del usuario. Si esta opción está desactivada, no se recolectarán datos analíticos de ningún tipo."
                />
                <Toggle
                  label="Discord RPC"
                  enabled={discordRPC}
                  onToggle={setDiscordRPC}
                  description="Controla la integración con Discord Rich Presence. Si está desactivado, 'DRK Launcher' dejará de aparecer como juego o aplicación en el perfil de Discord del usuario. Esto no bloquea integraciones específicas de mods o instancias. (Requiere reiniciar la app)."
                />
              </div>
            </div>
          </div>
        )
      case 'apariencia':
        return (
          <div className="space-y-5">
            <div className="mb-1">
              <h2 className="text-xl font-bold text-gray-100">Apariencia</h2>
              <p className="text-sm text-gray-400 mt-1">Personaliza la interfaz y el comportamiento de la aplicación</p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 transition-all duration-300 hover:border-gray-600/50">
              <div className="flex items-center mb-4">
                <div className="mr-3 p-2 bg-primary/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-200">Tema de Color</h3>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <SettingsSelect label="Tema" value={theme} onChange={e => setTheme(e.target.value as 'dark'|'light'|'oled')}>
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                  <option value="oled">OLED (Fondos negros)</option>
                </SettingsSelect>
                <SettingsSelect label="Idioma" value={language} onChange={e => setLanguage(e.target.value as 'es'|'en')}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </SettingsSelect>
              </div>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 transition-all duration-300 hover:border-gray-600/50">
              <div className="flex items-center mb-4">
                <div className="mr-3 p-2 bg-primary/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-200">Inicio y Navegación</h3>
              </div>
              <div className='space-y-4'>
                <SettingsSelect label="Página de inicio por defecto" value={defaultLandingPage} onChange={e => setDefaultLandingPage(e.target.value as 'home' | 'recent-worlds' | 'instances' | 'servers')}>
                  <option value="home">Inicio</option>
                  <option value="recent-worlds">Mundos recientes</option>
                  <option value="instances">Instancias</option>
                  <option value="servers">Servidores</option>
                </SettingsSelect>
                <Toggle
                  label="Volver rápidamente a mundos"
                  enabled={jumpBackToWorlds}
                  onToggle={setJumpBackToWorlds}
                  description="Accede directamente a los mundos que jugaste recientemente desde la página de inicio."
                />
              </div>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 transition-all duration-300 hover:border-gray-600/50">
              <div className="flex items-center mb-4">
                <div className="mr-3 p-2 bg-primary/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-200">Rendimiento y Renderizado</h3>
              </div>
              <div className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <SettingsSelect label="Calidad de Gráficos" value={advancedRendering.graphics} onChange={e => setAdvancedRendering({...advancedRendering, graphics: e.target.value as 'fast' | 'fancy'})}>
                    <option value="fancy">Detallada (Mejor aspecto)</option>
                    <option value="fast">Rápida (Mejor rendimiento)</option>
                  </SettingsSelect>
                  <SettingsSelect label="Nivel de Partículas" value={advancedRendering.particles} onChange={e => setAdvancedRendering({...advancedRendering, particles: e.target.value as 'minimal' | 'decreased' | 'all'})}>
                    <option value="all">Todas</option>
                    <option value="decreased">Reducidas</option>
                    <option value="minimal">Mínimas</option>
                  </SettingsSelect>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <SettingsInput label="Distancia de Renderizado (chunks)" type="number" min="2" max="32" value={advancedRendering.renderDistance} onChange={e => setAdvancedRendering({...advancedRendering, renderDistance: parseInt(e.target.value)})} />
                  <SettingsInput label="Iluminación Suave (0-2)" type="number" min="0" max="2" value={advancedRendering.smoothLighting} onChange={e => setAdvancedRendering({...advancedRendering, smoothLighting: parseInt(e.target.value)})} />
                </div>
                <div className="pt-2">
                  <p className="text-xs text-gray-400 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Ajusta estas opciones si experimentas lentitud o problemas de rendimiento
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      case 'recursos':
        return (
          <div className="space-y-5">
            <div className="mb-1">
              <h2 className="text-xl font-bold text-gray-100">Recursos</h2>
              <p className="text-sm text-gray-400 mt-1">Configura el uso de recursos del sistema</p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 transition-all duration-300 hover:border-gray-600/50">
              <div className="flex items-center mb-4">
                <div className="mr-3 p-2 bg-primary/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-200">Gestión de Memoria</h3>
              </div>
              <div className="space-y-3">
                <SettingsInput label="Memoria RAM máxima (MB)" type="number" value={defaultRamMb} onChange={e => setDefaultRamMb(parseInt(e.target.value))} />
                <p className="text-xs text-gray-400">Recomendado: 4096 MB. Ajusta según la RAM disponible en tu sistema.</p>
              </div>
            </div>
          </div>
        )
      case 'java':
        return (
          <div className="space-y-5">
            <div className="mb-1">
              <h2 className="text-xl font-bold text-gray-100">Java</h2>
              <p className="text-sm text-gray-400 mt-1">Configuración del entorno de ejecución de Java</p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 transition-all duration-300 hover:border-gray-600/50">
              <div className="flex items-center mb-4">
                <div className="mr-3 p-2 bg-primary/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v8l4-2 4 2V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-200">Configuración de Java</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingsSelect
                    label="Versión de Java recomendada"
                    value={javaPath.includes('8') ? '8' : javaPath.includes('17') ? '17' : javaPath.includes('21') ? '21' : 'auto'}
                    onChange={(e) => {
                      // Actualizar javaPath según la selección del usuario
                      // En una implementación real, esto buscaría o instalaría la versión seleccionada
                      if (e.target.value !== 'auto') {
                        alert(`Seleccionaste Java ${e.target.value}. Si no está instalado, puedes usar "Instalar recomendado" para descargarlo.`);
                      }
                    }}
                  >
                    <option value="auto">Detectar automáticamente</option>
                    <option value="8">Java 8 (Minecraft 1.16.5 o anterior)</option>
                    <option value="17">Java 17 (Minecraft 1.17-1.20.4)</option>
                    <option value="21">Java 21 (Minecraft 1.20.5+)</option>
                  </SettingsSelect>
                  <SettingsInput label="Ruta al ejecutable de Java" value={javaPath} onChange={e => setJavaPath(e.target.value)} placeholder="Autodetectar" />
                </div>

                <div className="flex gap-2 pt-1 flex-wrap">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        // Verificar si la API de Java está disponible
                        if (!(window as any).api || !(window as any).api.java) {
                          alert('La API de Java no está disponible. Por favor reinicie la aplicación.');
                          console.error('API de Java no disponible');
                          return;
                        }

                        if (typeof (window as any).api.java.detect !== 'function') {
                          alert('La función de detección de Java no está disponible.');
                          console.error('Función detect no disponible');
                          return;
                        }

                        const installations = await (window as any).api.java.detect();
                        if (installations && installations.length > 0) {
                          // Mostrar instalaciones encontradas en un menú desplegable o selector
                          const foundPaths = installations.map(inst => `${inst.version}: ${inst.path}`).join('\n');
                          alert(`Instalaciones encontradas:\n${foundPaths}`);

                          // Opcionalmente, podríamos actualizar javaPath si encontramos una instalación adecuada
                          if (installations[0]) {
                            setJavaPath(installations[0].path);
                          }
                        } else {
                          alert('No se encontraron instalaciones de Java en tu sistema');
                        }
                      } catch (error) {
                        console.error('Error detectando Java:', error);
                        alert('Error detectando instalaciones de Java');
                      }
                    }}
                  >
                    Detectar Java
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const javaPathResult = await (window as any).api.java.explore();
                        if (javaPathResult) {
                          setJavaPath(javaPathResult);
                        }
                      } catch (error) {
                        console.error('Error explorando Java:', error);
                        alert('Error al explorar archivo de Java');
                      }
                    }}
                  >
                    Explorar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        // Detectar la versión adecuada según la selección del usuario o la necesidad
                        // Por defecto, sugerimos Java 21 para Minecraft más recientes
                        const recommendedVersion = "21"; // En una implementación real, esto podría ser dinámico
                        const result = await (window as any).api.java.install(recommendedVersion);

                        if (result.success) {
                          alert(result.message);
                          // Opcionalmente, actualizar la ruta de Java con la nueva instalación
                          if (result.path) {
                            setJavaPath(result.path);
                          }
                        } else {
                          alert(`Error: ${result.message}`);
                        }
                      } catch (error) {
                        console.error('Error instalando Java:', error);
                        alert('Error instalando Java recomendado');
                      }
                    }}
                  >
                    Instalar recomendado
                  </Button>
                  <Button
                    onClick={async () => {
                      // Implementar prueba de Java
                      try {
                        if (!javaPath) {
                          alert('Por favor, establezca una ruta de Java antes de probar');
                          return;
                        }

                        // Llamar a la función real de prueba de Java
                        const result = await (window as any).api.java.test(javaPath);

                        if (result.success) {
                          alert(`Prueba de Java exitosa:\n${result.message}`);
                        } else {
                          alert(`Error en prueba de Java:\n${result.message}`);
                        }
                      } catch (error) {
                        console.error('Error probando Java:', error);
                        alert('Error probando la configuración de Java');
                      }
                    }}
                  >
                    Probar
                  </Button>
                </div>
                <div className="pt-3">
                  <h4 className="font-medium text-gray-200 mb-2">Guía de versión de Java</h4>
                  <div className="text-xs text-gray-300 space-y-2">
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="font-medium text-primary mb-1">_compatibilidad y Recomendación_</p>
                      <p>• <strong>Java 21</strong>: Recomendado para Minecraft 1.20.5+ y futuras versiones</p>
                      <p>• <strong>Java 17</strong>: Compatible con Minecraft 1.17 a 1.20.4</p>
                      <p>• <strong>Java 8</strong>: Necesario para versiones de Minecraft 1.16.5 o anteriores y modpacks heredados</p>
                    </div>
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="font-medium text-primary mb-1">_Rendimiento_</p>
                      <p>Java 21 ofrece mejoras de rendimiento, especialmente en manejo de memoria y recolección de basura, comparado con Java 17 y 8, lo que puede traducirse en mayor estabilidad y FPS en Minecraft.</p>
                    </div>
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="font-medium text-primary mb-1">_Acción recomendada_</p>
                      <p>Si necesitas Java 8 para un modpack antiguo, el botón "Instalar recomendado" es la opción más sencilla, ya que puede descargar e instalar automáticamente la versión adecuada de Java.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'instancias':
        return (
          <div className="space-y-5">
            <div className="mb-1">
              <h2 className="text-xl font-bold text-gray-100">Instancias</h2>
              <p className="text-sm text-gray-400 mt-1">Gestión de directorios y ubicaciones de instancias</p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 transition-all duration-300 hover:border-gray-600/50">
              <div className="flex items-center mb-4">
                <div className="mr-3 p-2 bg-primary/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                    <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-200">Ubicación de Instancias</h3>
              </div>
              <div className="space-y-3">
                <SettingsInput label="Directorio base de instancias" value={instancesBase} onChange={e => setInstancesBase(e.target.value)} placeholder="Por defecto" />
                <p className="text-xs text-gray-400">Aquí se guardarán tus instancias de Minecraft.</p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajustes">
        <div className="flex gap-4 -m-4 p-3">
            <div className="w-1/4 self-start bg-gray-900/80 border-r border-gray-700 p-2 rounded-l-lg">
                <div className="space-y-1">
                    <TabButton icon="privacy" isActive={activeTab === 'privacidad'} onClick={() => setActiveTab('privacidad')}>Privacidad</TabButton>
                    <TabButton icon="appearance" isActive={activeTab === 'apariencia'} onClick={() => setActiveTab('apariencia')}>Apariencia</TabButton>
                    <TabButton icon="resources" isActive={activeTab === 'recursos'} onClick={() => setActiveTab('recursos')}>Recursos</TabButton>
                    <TabButton icon="java" isActive={activeTab === 'java'} onClick={() => setActiveTab('java')}>Java</TabButton>
                    <TabButton icon="instances" isActive={activeTab === 'instancias'} onClick={() => setActiveTab('instancias')}>Instancias</TabButton>
                </div>
            </div>

            <div className="w-3/4">
                <div className="min-h-[250px] space-y-4">
                    {renderContent()}
                </div>
                <div className="flex justify-end mt-6 gap-2">
                    <Button onClick={onClose} variant="secondary">Cancelar</Button>
                    <Button onClick={handleSave}>Guardar</Button>
                </div>
            </div>
        </div>
    </Modal>
  )
}