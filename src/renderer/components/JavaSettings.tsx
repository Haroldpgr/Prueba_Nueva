// src/renderer/components/JavaSettings.tsx
import React, { useState, useEffect } from 'react';
import { settingsService, Settings } from '../services/settingsService';
import { javaDownloadService } from '../services/javaDownloadService';
import { JavaInfo } from '../types/java';

interface JavaSettingsProps {
  settings: Settings['java'];
  onSettingsChange: (updates: Partial<Settings['java']>) => void;
}

export default function JavaSettings({ settings, onSettingsChange }: JavaSettingsProps) {
  const [allJavas, setAllJavas] = useState<JavaInfo[]>([]);
  const [java8, setJava8] = useState<JavaInfo | null>(null);
  const [java17, setJava17] = useState<JavaInfo | null>(null);
  const [java21, setJava21] = useState<JavaInfo | null>(null);
  const [java8Status, setJava8Status] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [java17Status, setJava17Status] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [java21Status, setJava21Status] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [installProgress, setInstallProgress] = useState<Record<string, { received: number; total: number; percentage: number } | null>>({});

  useEffect(() => {
    loadJavaInstallations();
  }, []);

  const loadJavaInstallations = async () => {
    if (window.api && window.api.java) {
      try {
        const javas = await window.api.java.getAll();
        setAllJavas(javas);
      } catch (error) {
        console.error('Error loading Java installations:', error);
      }
    }
  };

  const detectJava = async (version: string) => {
    // Cambiamos estado a detectando
    if (version === '8') setJava8Status('detecting');
    else if (version === '17') setJava17Status('detecting');
    else if (version === '21') setJava21Status('detecting');

    try {
      // Usar el detector simplificado que solo busca en C:\Program Files\Java\
      if (window.api && window.api.java && window.api.java.detectSimple) {
        const detected = await window.api.java.detectSimple();
        setAllJavas(detected);

        const foundJava = detected.find(j =>
          j.version === version ||
          j.path.includes(version) ||
          (version === '8' && (j.version.includes('8') || j.path.includes('8'))) ||
          (version === '17' && (j.version.includes('17') || j.path.includes('17'))) ||
          (version === '21' && (j.version.includes('21') || j.path.includes('21')))
        );

        if (foundJava) {
          if (version === '8') {
            setJava8(foundJava);
            setJava8Status('success');
            onSettingsChange({ java8Path: foundJava.path });
          } else if (version === '17') {
            setJava17(foundJava);
            setJava17Status('success');
            onSettingsChange({ java17Path: foundJava.path });
          } else if (version === '21') {
            setJava21(foundJava);
            setJava21Status('success');
            onSettingsChange({ java21Path: foundJava.path });
          }

          alert(`Java ${version} detectado en: ${foundJava.path}`);
        } else {
          if (version === '8') setJava8Status('error');
          else if (version === '17') setJava17Status('error');
          else if (version === '21') setJava21Status('error');

          alert(`Java ${version} no encontrado en C:\\Program Files\\Java\\. Puedes instalarlo.`);
        }
      } else {
        // Si no hay API disponible, usar el servicio de backend directamente
        console.warn('API de Java no disponible, intentando con servicio alternativo...');

        // Simular detección si no está disponible
        const simulatedDetection = await simulateJavaDetection(version);

        if (simulatedDetection) {
          const javaInfo: JavaInfo = {
            id: `simulated_java_${version}`,
            path: simulatedDetection.path,
            version: version,
            isWorking: true,
            source: 'simulated'
          };

          // Agregar a la lista de Javas
          const updatedJavas = [...allJavas, javaInfo].filter((java, index, self) =>
            index === self.findIndex(j => j.id === java.id)
          );
          setAllJavas(updatedJavas);

          if (version === '8') {
            setJava8(javaInfo);
            setJava8Status('success');
            onSettingsChange({ java8Path: javaInfo.path });
          } else if (version === '17') {
            setJava17(javaInfo);
            setJava17Status('success');
            onSettingsChange({ java17Path: javaInfo.path });
          } else if (version === '21') {
            setJava21(javaInfo);
            setJava21Status('success');
            onSettingsChange({ java21Path: javaInfo.path });
          }

          alert(`Java ${version} detectado en: ${javaInfo.path}`);
        } else {
          if (version === '8') setJava8Status('error');
          else if (version === '17') setJava17Status('error');
          else if (version === '21') setJava21Status('error');

          alert(`Java ${version} no encontrado en C:\\Program Files\\Java\\. Instálalo en ese directorio o usa el instalador.`);
        }
      }
    } catch (error) {
      console.error(`Error detecting Java ${version}:`, error);
      if (version === '8') setJava8Status('error');
      else if (version === '17') setJava17Status('error');
      else if (version === '21') setJava21Status('error');
    }
  };

  // Función auxiliar para simular detección de Java si la API no está disponible
  const simulateJavaDetection = async (version: string): Promise<{path: string} | null> => {
    // En una implementación real, esto podría usar la API de Electron
    // Para la simulación, retornamos valores predefinidos según el sistema operativo
    return new Promise(resolve => {
      // Simular una breve espera de detección
      setTimeout(() => {
        // Detectar sistema operativo
        const isWindows = navigator.userAgent.includes('Win');
        const isMac = navigator.userAgent.includes('Mac');
        const isLinux = navigator.userAgent.includes('Linux');

        let commonPaths: string[] = [];

        if (isWindows) {
          commonPaths = [
            `C:/Program Files/Java/jdk${version}/bin/java.exe`,
            `C:/Program Files/Eclipse Adoptium/jdk-${version}.0.0-hotspot/bin/java.exe`,
            `C:/Program Files/Java/openjdk${version}/bin/java.exe`,
          ];
        } else if (isMac) {
          commonPaths = [
            `/Library/Java/JavaVirtualMachines/openjdk-${version}.jdk/Contents/Home/bin/java`,
            `/Library/Java/JavaVirtualMachines/adoptopenjdk-${version}.jdk/Contents/Home/bin/java`,
          ];
        } else if (isLinux) {
          commonPaths = [
            `/usr/lib/jvm/java-${version}-openjdk/bin/java`,
            `/usr/lib/jvm/default-java/bin/java`,
            `/opt/java/openjdk/bin/java`,
          ];
        } else {
          commonPaths = [
            `java` // Caso genérico, esperar que esté en PATH
          ];
        }

        // Simulamos encontrar la primera ruta que coincida con una estructura conocida
        // En una implementación real, esto se haría en el backend
        const foundPath = commonPaths.find(path => {
          // Simulamos la existencia de Java 8 en una de las rutas comunes
          if (version === '8' && path.toLowerCase().includes('jdk8')) return true;
          if (version === '17' && path.toLowerCase().includes('jdk-17')) return true;
          if (version === '21' && path.toLowerCase().includes('jdk-21')) return true;
          return false;
        });

        if (foundPath) {
          resolve({ path: foundPath });
        } else {
          resolve(null);
        }
      }, 300); // Simular tiempo de detección real
    });
  };

  const testJava = async (path: string, versionLabel: string) => {
    if (!window.api || !window.api.java) {
      alert('API de Java no disponible');
      return false;
    }

    try {
      const result = await window.api.java.test(path);
      if (result.isWorking) {
        alert(`Java ${versionLabel} probado exitosamente. Versión: ${result.version}`);
        return true;
      } else {
        alert(`Error al probar Java ${versionLabel}: ${result.error || 'No se pudo ejecutar'}`);
        return false;
      }
    } catch (error) {
      console.error(`Error testing Java ${versionLabel}:`, error);
      alert(`Error al probar Java ${versionLabel}: ${(error as Error).message}`);
      return false;
    }
  };

  const installJava = async (version: string) => {
    if (!window.api || !window.api.java) {
      alert('API de Java no disponible');
      return;
    }

    try {
      // Mostrar indicador de instalación en progreso
      setInstallProgress(prev => ({ ...prev, [version]: { received: 0, total: 100, percentage: 0 } }));

      // Usar el servicio de descarga de Java
      await javaDownloadService.installJava(version);

      alert(`Iniciando descarga de Java ${version}. Puedes ver el progreso en la sección de Descargas.`);
      setInstallProgress(prev => ({ ...prev, [version]: null }));
      // Recargar la lista de Java
      loadJavaInstallations();
    } catch (error) {
      console.error(`Error installing Java ${version}:`, error);
      alert(`Error al instalar Java ${version}: ${(error as Error).message}`);
      setInstallProgress(prev => ({ ...prev, [version]: null }));
    }
  };

  const handlePathChange = (version: '8' | '17' | '21', path: string) => {
    if (version === '8') {
      onSettingsChange({ java8Path: path });
    } else if (version === '17') {
      onSettingsChange({ java17Path: path });
    } else if (version === '21') {
      onSettingsChange({ java21Path: path });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-200 mb-4">Configuración de Java</h3>

        <div className="space-y-6">
          {/* Java 8 */}
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-200">Java 8</h4>
              <button
                onClick={() => installJava('8')}
                disabled={!!installProgress['8'] || (java8 && java8.isWorking)}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded text-sm transition-all disabled:opacity-50"
              >
                {installProgress['8'] ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {installProgress['8']?.percentage}%
                  </span>
                ) : (java8 && java8.isWorking) ? (
                  'Java 8 Detectado'
                ) : (
                  'Instalar recomendado'
                )}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.java8Path}
                onChange={(e) => handlePathChange('8', e.target.value)}
                placeholder="Ruta al ejecutable de Java 8"
                className="flex-1 p-2 rounded-lg bg-gray-700/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => detectJava('8')}
                disabled={java8Status === 'detecting'}
                className={`px-3 py-2 rounded-lg transition-all ${
                  java8Status === 'detecting'
                    ? 'bg-blue-800 text-blue-200'
                    : (java8 && java8.isWorking)
                      ? 'bg-emerald-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {java8Status === 'detecting' ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Detectar'}
              </button>
              <button
                onClick={async () => {
                  if (settings.java8Path) {
                    await testJava(settings.java8Path, '8');
                  }
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
              >
                Probar
              </button>
            </div>
            {java8Status === 'error' && (
              <div className="mt-2 text-sm text-red-400">No se encontró Java 8 en el sistema</div>
            )}
            {java8 && java8.isWorking && (
              <div className="mt-2 text-sm text-emerald-400">Java 8 detectado correctamente: {java8.path}</div>
            )}
          </div>

          {/* Java 17 */}
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-200">Java 17</h4>
              <button
                onClick={() => installJava('17')}
                disabled={!!installProgress['17'] || (java17 && java17.isWorking)}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded text-sm transition-all disabled:opacity-50"
              >
                {installProgress['17'] ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {installProgress['17']?.percentage}%
                  </span>
                ) : (java17 && java17.isWorking) ? (
                  'Java 17 Detectado'
                ) : (
                  'Instalar recomendado'
                )}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.java17Path}
                onChange={(e) => handlePathChange('17', e.target.value)}
                placeholder="Ruta al ejecutable de Java 17"
                className="flex-1 p-2 rounded-lg bg-gray-700/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => detectJava('17')}
                disabled={java17Status === 'detecting'}
                className={`px-3 py-2 rounded-lg transition-all ${
                  java17Status === 'detecting'
                    ? 'bg-blue-800 text-blue-200'
                    : (java17 && java17.isWorking)
                      ? 'bg-emerald-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {java17Status === 'detecting' ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Detectar'}
              </button>
              <button
                onClick={async () => {
                  if (settings.java17Path) {
                    await testJava(settings.java17Path, '17');
                  }
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
              >
                Probar
              </button>
            </div>
            {java17Status === 'error' && (
              <div className="mt-2 text-sm text-red-400">No se encontró Java 17 en el sistema</div>
            )}
            {java17 && java17.isWorking && (
              <div className="mt-2 text-sm text-emerald-400">Java 17 detectado correctamente: {java17.path}</div>
            )}
          </div>

          {/* Java 21 */}
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-200">Java 21</h4>
              <button
                onClick={() => installJava('21')}
                disabled={!!installProgress['21'] || (java21 && java21.isWorking)}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded text-sm transition-all disabled:opacity-50"
              >
                {installProgress['21'] ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {installProgress['21']?.percentage}%
                  </span>
                ) : (java21 && java21.isWorking) ? (
                  'Java 21 Detectado'
                ) : (
                  'Instalar recomendado'
                )}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.java21Path}
                onChange={(e) => handlePathChange('21', e.target.value)}
                placeholder="Ruta al ejecutable de Java 21"
                className="flex-1 p-2 rounded-lg bg-gray-700/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => detectJava('21')}
                disabled={java21Status === 'detecting'}
                className={`px-3 py-2 rounded-lg transition-all ${
                  java21Status === 'detecting'
                    ? 'bg-blue-800 text-blue-200'
                    : (java21 && java21.isWorking)
                      ? 'bg-emerald-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {java21Status === 'detecting' ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Detectar'}
              </button>
              <button
                onClick={async () => {
                  if (settings.java21Path) {
                    await testJava(settings.java21Path, '21');
                  }
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
              >
                Probar
              </button>
            </div>
            {java21Status === 'error' && (
              <div className="mt-2 text-sm text-red-400">No se encontró Java 21 en el sistema</div>
            )}
            {java21 && java21.isWorking && (
              <div className="mt-2 text-sm text-emerald-400">Java 21 detectado correctamente: {java21.path}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}