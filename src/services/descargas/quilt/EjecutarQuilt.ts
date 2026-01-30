// src/services/descargas/quilt/EjecutarQuilt.ts
// Lógica CORRECTA para ejecutar Quilt Loader
// Basado en: https://quiltmc.org/en/ y documentación oficial
// Similar a Fabric pero usando la API v3 de Quilt

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { Profile } from '../../../renderer/services/profileService';
import { logProgressService } from '../../logProgressService';
import { gameLogsService } from '../../gameLogsService';
import { InstanceConfig } from '../../enhancedInstanceCreationService';
import { ModDetectionService } from '../../modDetectionService';
import { minecraftDownloadService } from '../../minecraftDownloadService';
import { getLauncherDataPath } from '../../../utils/paths';
import { ensureValidUUID } from '../../../utils/uuid';
import { JavaConfigService } from '../../javaConfigService';
import fetch from 'node-fetch';

export interface QuiltLaunchOptions {
  javaPath: string;
  mcVersion: string;
  loaderVersion: string;
  instancePath: string;
  ramMb?: number;
  jvmArgs?: string[];
  gameArgs?: string[];
  userProfile?: Profile;
  windowSize?: {
    width: number;
    height: number;
  };
  onData?: (chunk: string) => void;
  onExit?: (code: number | null) => void;
}

/**
 * Servicio para ejecutar instancias Quilt de Minecraft
 *
 * IMPORTANTE: Quilt usa KnotClient (org.quiltmc.loader.impl.launch.knot.KnotClient)
 * ya que está basado en Fabric Loader. El version.json de Quilt hereda de vanilla.
 */
export class EjecutarQuilt {
  private gameProcess: ChildProcess | null = null;

  /**
   * Ejecuta una instancia Quilt
   */
  async ejecutar(opts: QuiltLaunchOptions): Promise<ChildProcess> {
    try {
      logProgressService.info(`[Quilt] Iniciando ejecución de Quilt ${opts.loaderVersion} para Minecraft ${opts.mcVersion}...`);

      // Validación 1: client.jar existe
      const clientJarPath = path.join(opts.instancePath, 'client.jar');
      if (!fs.existsSync(clientJarPath)) {
        const error = new Error(`client.jar no encontrado en ${clientJarPath}`);
        logProgressService.error(`[Quilt] ERROR CRÍTICO: ${error.message}`);
        throw error;
      }

      // Validar tamaño del client.jar
      try {
        const stats = fs.statSync(clientJarPath);
        if (stats.size < 1024 * 1024) { // Menos de 1MB
          logProgressService.warning(`[Quilt] ADVERTENCIA: client.jar tiene tamaño inusualmente pequeño: ${stats.size} bytes`);
        }
        logProgressService.info(`[Quilt] client.jar validado: ${stats.size} bytes`);
      } catch (statError) {
        logProgressService.error(`[Quilt] Error al validar client.jar: ${statError}`);
        throw new Error(`No se pudo validar client.jar: ${statError}`);
      }

      // Validación 2: version.json de Quilt existe
      const launcherDataPath = getLauncherDataPath();
      const quiltVersionName = `quilt-loader-${opts.loaderVersion}-${opts.mcVersion}`;
      const quiltVersionJsonPath = path.join(launcherDataPath, 'versions', quiltVersionName, `${quiltVersionName}.json`);
      
      if (!fs.existsSync(quiltVersionJsonPath)) {
        const error = new Error(`Version.json de Quilt no encontrado en: ${quiltVersionJsonPath}`);
        logProgressService.error(`[Quilt] ERROR CRÍTICO: ${error.message}`);
        logProgressService.error(`[Quilt] Asegúrate de que Quilt Loader esté instalado correctamente.`);
        throw error;
      }

      logProgressService.info(`[Quilt] Version.json de Quilt encontrado: ${quiltVersionName}`);

      // Validación 3: Verificar mods y QSL (Quilt Standard Libraries)
      try {
        const mods = ModDetectionService.detectInstalledMods(opts.instancePath, 'quilt');
        const hasQSL = mods.some(m => 
          m.id.toLowerCase().includes('qsl') || 
          m.id.toLowerCase().includes('quilt-standard') ||
          m.id.toLowerCase().includes('quilted-fabric-api')
        );
        
        if (mods.length > 0 && !hasQSL) {
          logProgressService.warning(`[Quilt] ⚠️ ADVERTENCIA: Se detectaron ${mods.length} mod(s) pero Quilt Standard Libraries (QSL) no está instalado.`);
          logProgressService.warning(`[Quilt] Muchos mods pueden no funcionar sin QSL. Considera instalar Quilt Standard Libraries.`);
        } else if (mods.length > 0) {
          logProgressService.info(`[Quilt] ✓ ${mods.length} mod(s) detectado(s). QSL presente.`);
        } else {
          logProgressService.info(`[Quilt] No se detectaron mods instalados.`);
        }
      } catch (modError) {
        logProgressService.warning(`[Quilt] Error al detectar mods (continuando): ${modError}`);
        // No fallar si hay error detectando mods
      }

      // Obtener la configuración de la instancia
      let instanceId = path.basename(opts.instancePath);
      try {
        const { instanceService } = await import('../../instanceService');
        const config = instanceService.getInstanceConfig(opts.instancePath);
        if (config?.id) {
          instanceId = config.id;
        }
      } catch {
        // Si falla, usar el basename como fallback
      }

      const instanceConfig: InstanceConfig = {
        id: instanceId,
        name: path.basename(opts.instancePath),
        version: opts.mcVersion,
        loader: 'quilt',
        loaderVersion: opts.loaderVersion,
        path: opts.instancePath,
        createdAt: Date.now()
      };

      // Construir argumentos de lanzamiento
      logProgressService.info(`[Quilt] Construyendo argumentos de lanzamiento...`);
      const args = await this.buildLaunchArguments(opts, quiltVersionJsonPath);
      const stringArgs = args.map(arg => typeof arg === 'string' ? arg : String(arg));

      logProgressService.info(`[Quilt] Argumentos construidos (${stringArgs.length} argumentos totales)`);

      // Validación final antes de lanzar: verificar que el classpath tenga elementos
      const classpathIndex = stringArgs.findIndex(arg => arg === '-cp' || arg === '-classpath');
      if (classpathIndex !== -1 && classpathIndex + 1 < stringArgs.length) {
        const classpathValue = stringArgs[classpathIndex + 1];
        const classpathJars = classpathValue.split(path.delimiter);
        logProgressService.info(`[Quilt] Classpath contiene ${classpathJars.length} JARs`);
        
        // Verificar que client.jar esté en el classpath
        const hasClientJar = classpathJars.some(jar => jar.includes('client.jar'));
        if (!hasClientJar) {
          logProgressService.error(`[Quilt] ERROR CRÍTICO: client.jar NO está en el classpath!`);
          throw new Error('client.jar no está en el classpath');
        }

        // Verificar que Quilt Loader esté en el classpath
        const hasQuiltLoader = classpathJars.some(jar => 
          jar.includes('quilt-loader') || jar.includes('quilt_loader')
        );
        if (!hasQuiltLoader) {
          logProgressService.warning(`[Quilt] ADVERTENCIA: Quilt Loader no detectado en el classpath. Puede causar errores.`);
        }
      }

      // Crear el proceso hijo
      logProgressService.info(`[Quilt] Iniciando proceso Java...`);
      this.gameProcess = spawn(opts.javaPath, stringArgs, {
        cwd: opts.instancePath,
        env: {
          ...process.env
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.gameProcess.pid) {
        throw new Error('No se pudo iniciar el proceso Java');
      }

      logProgressService.info(`[Quilt] Proceso iniciado con PID: ${this.gameProcess.pid}`);

      // Manejar salida estándar
      if (this.gameProcess.stdout) {
        this.gameProcess.stdout.on('data', (data) => {
          try {
            const output = data.toString();
            logProgressService.info(`[Quilt-OUT] ${output}`);
            gameLogsService.addLog(instanceConfig.id, output);
            if (opts.onData) {
              opts.onData(output);
            }
          } catch (outputError) {
            logProgressService.error(`[Quilt] Error al procesar salida estándar: ${outputError}`);
          }
        });
      }

      // Manejar salida de error
      if (this.gameProcess.stderr) {
        this.gameProcess.stderr.on('data', (data) => {
          try {
            const output = data.toString();
            logProgressService.error(`[Quilt-ERR] ${output}`);
            gameLogsService.addLog(instanceConfig.id, output);
            if (opts.onData) {
              opts.onData(output);
            }
          } catch (errorError) {
            logProgressService.error(`[Quilt] Error al procesar salida de error: ${errorError}`);
          }
        });
      }

      // Manejar cierre del proceso
      this.gameProcess.on('close', (code, signal) => {
        if (code !== null) {
          logProgressService.info(`[Quilt] Proceso terminado con código ${code}`);
        } else if (signal) {
          logProgressService.info(`[Quilt] Proceso terminado por señal: ${signal}`);
        } else {
          logProgressService.info(`[Quilt] Proceso terminado`);
        }
        
        if (opts.onExit) {
          opts.onExit(code);
        }
        this.gameProcess = null;
      });

      // Manejar errores del proceso
      this.gameProcess.on('error', (error) => {
        logProgressService.error(`[Quilt] Error en el proceso Java: ${error.message}`);
        logProgressService.error(`[Quilt] Stack trace: ${error.stack || 'No disponible'}`);
        
        if (opts.onExit) {
          opts.onExit(null);
        }
        
        this.gameProcess = null;
        throw error;
      });

      logProgressService.success(`[Quilt] Minecraft lanzado exitosamente`, {
        pid: this.gameProcess.pid
      });

      return this.gameProcess;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logProgressService.error(`[Quilt] ERROR al ejecutar: ${errorMessage}`);
      if (errorStack) {
        logProgressService.error(`[Quilt] Stack trace: ${errorStack}`);
      }
      
      throw error;
    }
  }

  /**
   * Construye los argumentos de lanzamiento para Quilt
   * 
   * IMPORTANTE: Quilt usa el version.json que hereda de vanilla.
   * Necesitamos leer el version.json de Quilt y resolver el inheritsFrom.
   */
  private async buildLaunchArguments(
    opts: QuiltLaunchOptions,
    quiltVersionJsonPath: string
  ): Promise<string[]> {
    try {
      const mem = Math.max(512, opts.ramMb || 2048);
      const jvmArgs = JavaConfigService.getStandardJvmArgs('quilt', mem);
      
      logProgressService.info(`[Quilt] Memoria configurada: ${mem}MB`);
      logProgressService.info(`[Quilt] JVM args base: ${jvmArgs.length} argumentos`);

      const launcherDataPath = getLauncherDataPath();
      const libraryJars: string[] = [];
      const nativeLibraries: string[] = [];

      // PASO 1: Leer version.json de Quilt
      logProgressService.info(`[Quilt] Leyendo version.json de Quilt...`);
      let quiltVersionData: any;
      try {
        const quiltVersionContent = fs.readFileSync(quiltVersionJsonPath, 'utf-8');
        quiltVersionData = JSON.parse(quiltVersionContent);
        
        if (!quiltVersionData.mainClass) {
          throw new Error('version.json de Quilt no tiene mainClass');
        }
        if (!quiltVersionData.libraries || !Array.isArray(quiltVersionData.libraries)) {
          throw new Error('version.json de Quilt no tiene libraries válido');
        }
        
        logProgressService.info(`[Quilt] Version.json de Quilt leído: ${quiltVersionData.libraries.length} librerías`);
      } catch (readError) {
        logProgressService.error(`[Quilt] ERROR al leer version.json de Quilt: ${readError}`);
        throw new Error(`No se pudo leer version.json de Quilt: ${readError}`);
      }

      // PASO 2: Si tiene inheritsFrom, leer el version.json base (vanilla)
      let vanillaVersionData: any = null;
      if (quiltVersionData.inheritsFrom) {
        const vanillaVersionName = quiltVersionData.inheritsFrom;
        const vanillaVersionJsonPath = path.join(launcherDataPath, 'versions', vanillaVersionName, `${vanillaVersionName}.json`);
        
        logProgressService.info(`[Quilt] Version.json hereda de: ${vanillaVersionName}`);
        
        if (fs.existsSync(vanillaVersionJsonPath)) {
          try {
            const vanillaVersionContent = fs.readFileSync(vanillaVersionJsonPath, 'utf-8');
            vanillaVersionData = JSON.parse(vanillaVersionContent);
            logProgressService.info(`[Quilt] Version.json base (vanilla) leído: ${vanillaVersionData.libraries?.length || 0} librerías`);
          } catch (vanillaReadError) {
            logProgressService.warning(`[Quilt] ADVERTENCIA: No se pudo leer version.json base: ${vanillaReadError}`);
            logProgressService.warning(`[Quilt] Continuando solo con librerías de Quilt...`);
          }
        } else {
          logProgressService.warning(`[Quilt] ADVERTENCIA: Version.json base no encontrado: ${vanillaVersionJsonPath}`);
          logProgressService.warning(`[Quilt] Intentando descargar version.json base...`);
          
          try {
            // Intentar descargar el version.json base
            await minecraftDownloadService.downloadVersionMetadata(vanillaVersionName);
            if (fs.existsSync(vanillaVersionJsonPath)) {
              const vanillaVersionContent = fs.readFileSync(vanillaVersionJsonPath, 'utf-8');
              vanillaVersionData = JSON.parse(vanillaVersionContent);
              logProgressService.info(`[Quilt] Version.json base descargado y leído`);
            }
          } catch (downloadError) {
            logProgressService.warning(`[Quilt] No se pudo descargar version.json base: ${downloadError}`);
          }
        }
      }

      // PASO 3: Procesar librerías del version.json base (vanilla) primero
      if (vanillaVersionData && vanillaVersionData.libraries && Array.isArray(vanillaVersionData.libraries)) {
        logProgressService.info(`[Quilt] Procesando ${vanillaVersionData.libraries.length} librerías de vanilla...`);
        
        for (const lib of vanillaVersionData.libraries) {
          try {
            if (!this.isLibraryAllowed(lib.rules)) {
              continue;
            }

            if (lib.downloads?.artifact) {
              // Verificar si es librería nativa de otra plataforma
              if (this.isNativeLibraryForOtherPlatform(lib.name, lib.downloads.classifiers)) {
                continue;
              }

              let libPath: string;
              if (lib.downloads.artifact.path) {
                libPath = path.join(launcherDataPath, 'libraries', lib.downloads.artifact.path);
              } else {
                libPath = path.join(launcherDataPath, 'libraries', this.getLibraryPath(lib.name));
              }

              // Buscar en múltiples ubicaciones
              const possiblePaths = [
                libPath,
                path.join(opts.instancePath, 'libraries', this.getLibraryPath(lib.name)),
                path.join(process.env.APPDATA || process.env.HOME || '', '.minecraft', 'libraries', this.getLibraryPath(lib.name)),
              ];

              let found = false;
              for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                  if (!libraryJars.includes(possiblePath)) {
                    libraryJars.push(possiblePath);
                  }
                  found = true;
                  break;
                }
              }

              // Si no se encontró y hay URL, intentar descargar
              if (!found && lib.downloads.artifact.url) {
                try {
                  logProgressService.info(`[Quilt] Descargando librería faltante de vanilla: ${lib.name}`);
                  const libDir = path.dirname(libPath);
                  if (!fs.existsSync(libDir)) {
                    fs.mkdirSync(libDir, { recursive: true });
                  }

                  const response = await fetch(lib.downloads.artifact.url, {
                    headers: { 'User-Agent': 'DRK-Launcher/1.0' }
                  });

                  if (response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());
                    fs.writeFileSync(libPath, buffer);
                    logProgressService.info(`[Quilt] Librería de vanilla descargada: ${lib.name}`);
                    
                    if (!libraryJars.includes(libPath)) {
                      libraryJars.push(libPath);
                    }
                  } else {
                    logProgressService.warning(`[Quilt] Error HTTP al descargar librería ${lib.name}: ${response.status}`);
                  }
                } catch (downloadError) {
                  logProgressService.warning(`[Quilt] Error al descargar librería ${lib.name}: ${downloadError}`);
                }
              }

              // Procesar classifiers (nativas)
              if (lib.downloads.classifiers) {
                const currentOs = this.getOSClassifier();
                const nativeClassifier = lib.downloads.classifiers[currentOs];
                
                if (nativeClassifier && nativeClassifier.path) {
                  const nativePath = path.join(launcherDataPath, 'libraries', nativeClassifier.path);
                  if (fs.existsSync(nativePath)) {
                    nativeLibraries.push(nativePath);
                  }
                }
              }
            }
          } catch (libError) {
            logProgressService.warning(`[Quilt] Error al procesar librería de vanilla ${lib.name}: ${libError}`);
            // Continuar con las siguientes librerías
          }
        }
      }

      // PASO 4: Procesar librerías del version.json de Quilt
      logProgressService.info(`[Quilt] Procesando ${quiltVersionData.libraries.length} librerías de Quilt...`);

      let processedLibraries = 0;
      let quiltLoaderFound = false;

      for (const lib of quiltVersionData.libraries) {
        try {
          if (!this.isLibraryAllowed(lib.rules)) {
            continue;
          }

          if (lib.downloads?.artifact) {
            let libPath: string;
            if (lib.downloads.artifact.path) {
              libPath = path.join(launcherDataPath, 'libraries', lib.downloads.artifact.path);
            } else if (lib.name) {
              libPath = path.join(launcherDataPath, 'libraries', this.getLibraryPath(lib.name));
            } else {
              logProgressService.warning(`[Quilt] Librería sin nombre ni path, omitiendo`);
              continue;
            }

            // Buscar librería en múltiples ubicaciones posibles
            const possiblePaths = [
              libPath, // Ruta desde artifact.path
              path.join(launcherDataPath, 'libraries', this.getLibraryPath(lib.name || '')), // Ruta desde nombre Maven
              path.join(opts.instancePath, 'libraries', this.getLibraryPath(lib.name || '')), // Ruta en instancia
              path.join(process.env.APPDATA || process.env.HOME || '', '.minecraft', 'libraries', this.getLibraryPath(lib.name || '')), // Ruta estándar de .minecraft
            ];

            let found = false;
            for (const possiblePath of possiblePaths) {
              if (fs.existsSync(possiblePath)) {
                if (!libraryJars.includes(possiblePath)) {
                  libraryJars.push(possiblePath);
                  logProgressService.info(`[Quilt] Librería encontrada y añadida al classpath: ${path.basename(possiblePath)}`);
                }
                found = true;
                processedLibraries++;

                // Verificar si esta librería es el loader principal de Quilt
                if (lib.name && (lib.name.includes('quilt-loader') || lib.name.includes('quiltmc:quilt-loader'))) {
                  quiltLoaderFound = true;
                  logProgressService.info(`[Quilt] ¡Encontrado el loader principal de Quilt en: ${path.basename(possiblePath)}`);
                }
                break;
              }
            }

            if (!found && lib.downloads?.artifact) {
              try {
                // Determinar URL de descarga
                let downloadUrl: string | null = null;

                // Prioridad 1: URL desde downloads.artifact.url
                if (lib.downloads.artifact.url) {
                  downloadUrl = lib.downloads.artifact.url;
                }
                // Prioridad 2: Construir URL desde el nombre Maven para org.quiltmc.*
                else if (lib.name?.startsWith('org.quiltmc:')) {
                  downloadUrl = this.buildQuiltMavenUrl(lib.name);
                }
                // Prioridad 3: Maven Central para otras librerías
                else if (lib.name?.includes(':')) {
                  downloadUrl = this.buildMavenUrl(lib.name);
                }

                if (!downloadUrl) {
                  logProgressService.warning(`[Quilt] No se pudo construir URL para descargar librería: ${lib.name || 'sin nombre'}`);
                  continue;
                }

                logProgressService.info(`[Quilt] Descargando librería: ${lib.name || 'sin nombre'} desde ${downloadUrl}`);

                const response = await fetch(downloadUrl, {
                  headers: { 'User-Agent': 'DRK-Launcher/1.0' }
                });

                if (!response.ok) {
                  // Si falla con Maven Central y es org.quiltmc.*, intentar con repositorio de Quilt
                  if (downloadUrl.includes('repo1.maven.org') && lib.name?.startsWith('org.quiltmc:')) {
                    const quiltUrl = this.buildQuiltMavenUrl(lib.name);
                    if (quiltUrl !== downloadUrl) {
                      logProgressService.info(`[Quilt] Reintentando desde repositorio de Quilt...`);
                      const fallbackResponse = await fetch(quiltUrl, {
                        headers: { 'User-Agent': 'DRK-Launcher/1.0' }
                      });
                      if (fallbackResponse.ok) {
                        const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
                        const libDir = path.dirname(libPath);
                        if (!fs.existsSync(libDir)) {
                          fs.mkdirSync(libDir, { recursive: true });
                        }
                        fs.writeFileSync(libPath, buffer);
                        logProgressService.info(`[Quilt] ✓ Librería descargada desde repositorio de Quilt: ${path.basename(libPath)} (${(buffer.length / 1024).toFixed(2)} KB)`);

                        if (!libraryJars.includes(libPath)) {
                          libraryJars.push(libPath);
                        }
                        processedLibraries++;

                        // Verificar si esta librería es el loader principal de Quilt
                        if (lib.name && (lib.name.includes('quilt-loader') || lib.name.includes('quiltmc:quilt-loader'))) {
                          quiltLoaderFound = true;
                          logProgressService.info(`[Quilt] ¡Descargado el loader principal de Quilt: ${path.basename(libPath)}`);
                        }
                        continue; // Continuar con la siguiente librería
                      }
                    }
                  }
                  throw new Error(`HTTP ${response.status} - ${lib.name || 'sin nombre'}`);
                }

                const buffer = Buffer.from(await response.arrayBuffer());
                const libDir = path.dirname(libPath);
                if (!fs.existsSync(libDir)) {
                  fs.mkdirSync(libDir, { recursive: true });
                }
                fs.writeFileSync(libPath, buffer);
                logProgressService.info(`[Quilt] Librería de Quilt descargada: ${path.basename(libPath)} (${(buffer.length / 1024).toFixed(2)} KB)`);

                if (!libraryJars.includes(libPath)) {
                  libraryJars.push(libPath);
                }
                processedLibraries++;

                // Verificar si esta librería es el loader principal de Quilt
                if (lib.name && (lib.name.includes('quilt-loader') || lib.name.includes('quiltmc:quilt-loader'))) {
                  quiltLoaderFound = true;
                  logProgressService.info(`[Quilt] ¡Descargado el loader principal de Quilt: ${path.basename(libPath)}`);
                }
              } catch (downloadError) {
                logProgressService.warning(`[Quilt] Error al descargar librería: ${downloadError} - ${lib.name || 'sin nombre'}`);
              }
            }
          }
        } catch (libError) {
          logProgressService.warning(`[Quilt] Error al procesar librería de Quilt ${lib.name || 'sin nombre'}: ${libError}`);
          // Continuar con las siguientes librerías
        }
      }
      logProgressService.info(`[Quilt] Procesadas ${processedLibraries} librerías de Quilt para el classpath`);

      // Verificar si el loader principal de Quilt fue encontrado/procesado
      if (!quiltLoaderFound) {
        logProgressService.warning(`[Quilt] ADVERTENCIA: El loader principal de Quilt no fue encontrado en las librerías procesadas`);
        // Buscarlo explícitamente por nombre común
        const quiltLoaderInClasspath = libraryJars.some(jar =>
          path.basename(jar).includes('quilt-loader') && path.basename(jar).endsWith('.jar')
        );
        if (quiltLoaderInClasspath) {
          quiltLoaderFound = true;
          logProgressService.info(`[Quilt] Loader principal de Quilt encontrado en el classpath`);
        }
      }

      // PASO 5: Añadir client.jar al classpath
      const clientJar = path.join(opts.instancePath, 'client.jar');
      if (fs.existsSync(clientJar)) {
        libraryJars.push(clientJar);
        logProgressService.info(`[Quilt] client.jar añadido al classpath`);
      } else {
        logProgressService.error(`[Quilt] ERROR: client.jar no encontrado en ${clientJar}`);
        throw new Error(`client.jar no encontrado`);
      }

      // PASO 5.5: Añadir JAR del loader de Quilt al classpath
      // Buscar el JAR del loader en múltiples ubicaciones posibles

      // Buscar específicamente el JAR del loader de Quilt en el classpath actual
      // Usar la variable quiltLoaderFound ya declarada en la línea 426

      // Primero, buscar en las librerías ya procesadas
      if (!quiltLoaderFound) { // Solo buscar si no se encontró antes
        for (const jar of libraryJars) {
          if (jar.includes('quilt-loader') && jar.endsWith('.jar')) {
            logProgressService.info(`[Quilt] JAR del loader ya está en el classpath: ${path.basename(jar)}`);
            quiltLoaderFound = true;
            break;
          }
        }
      }

      if (!quiltLoaderFound) {
        // Si no está en las librerías procesadas, buscar en la carpeta loader de la instancia
        const loaderDir = path.join(opts.instancePath, 'loader');
        if (fs.existsSync(loaderDir)) {
          const loaderFiles = fs.readdirSync(loaderDir);
          const quiltLoaderJar = loaderFiles.find(file =>
            file.startsWith('quilt-loader-') && file.endsWith('.jar')
          );

          if (quiltLoaderJar) {
            const quiltLoaderPath = path.join(loaderDir, quiltLoaderJar);
            if (fs.existsSync(quiltLoaderPath)) {
              libraryJars.push(quiltLoaderPath);
              logProgressService.info(`[Quilt] JAR del loader añadido al classpath: ${quiltLoaderJar}`);
              quiltLoaderFound = true;
            }
          }
        }
      }

      if (!quiltLoaderFound) {
        // Buscar en el directorio de librerías del launcher
        const launcherDataPath = getLauncherDataPath();
        const librariesPath = path.join(launcherDataPath, 'libraries');

        // Buscar recursivamente el JAR del loader de Quilt
        const findQuiltLoader = (dir: string): string | null => {
          if (!fs.existsSync(dir)) return null;

          const items = fs.readdirSync(dir);
          for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
              const result = findQuiltLoader(itemPath);
              if (result) return result;
            } else if (item.startsWith('quilt-loader-') && item.endsWith('.jar')) {
              return itemPath;
            }
          }
          return null;
        };

        const quiltLoaderPath = findQuiltLoader(librariesPath);
        if (quiltLoaderPath && fs.existsSync(quiltLoaderPath) && !libraryJars.includes(quiltLoaderPath)) {
          libraryJars.push(quiltLoaderPath);
          logProgressService.info(`[Quilt] JAR del loader encontrado y añadido al classpath: ${path.basename(quiltLoaderPath)}`);
          quiltLoaderFound = true;
        }
      }

      if (!quiltLoaderFound) {
        logProgressService.warning(`[Quilt] ADVERTENCIA: No se encontró el JAR del loader de Quilt en ninguna ubicación conocida`);
      }

      // PASO 5.6: Asegurar que todas las librerías del perfil de Quilt estén en el classpath
      // A veces las librerías se procesaron pero no se añadieron al classpath por problemas de búsqueda
      logProgressService.info(`[Quilt] Validando que todas las librerías del perfil estén en el classpath...`);

      // Buscar librerías del perfil que no estén en el classpath actual
      if (quiltVersionData.libraries && Array.isArray(quiltVersionData.libraries)) {
        for (const lib of quiltVersionData.libraries) {
          if (!lib.name) continue;

          // Verificar reglas de compatibilidad
          if (lib.rules && !this.isLibraryAllowed(lib.rules)) {
            continue;
          }

          // Construir la ruta esperada de la librería
          let expectedLibPath: string | null = null;

          if (lib.downloads?.artifact?.path) {
            expectedLibPath = path.join(launcherDataPath, 'libraries', lib.downloads.artifact.path);
          } else if (lib.name) {
            expectedLibPath = path.join(launcherDataPath, 'libraries', this.getLibraryPath(lib.name));
          }

          if (expectedLibPath) {
            // Buscar en múltiples ubicaciones como hicimos antes
            const possiblePaths = [
              expectedLibPath,
              path.join(launcherDataPath, 'libraries', this.getLibraryPath(lib.name)),
              path.join(opts.instancePath, 'libraries', this.getLibraryPath(lib.name)),
              path.join(process.env.APPDATA || process.env.HOME || '', '.minecraft', 'libraries', this.getLibraryPath(lib.name)),
            ];

            let libFound = false;
            for (const possiblePath of possiblePaths) {
              if (fs.existsSync(possiblePath)) {
                if (!libraryJars.includes(possiblePath)) {
                  libraryJars.push(possiblePath);
                  logProgressService.info(`[Quilt] Librería adicional añadida al classpath: ${path.basename(possiblePath)}`);
                }
                libFound = true;
                break;
              }
            }

            // Si no se encontró y hay URL de descarga, intentar descargar
            if (!libFound && lib.downloads?.artifact) {
              try {
                // Determinar URL de descarga como hicimos antes
                let downloadUrl: string | null = null;

                if (lib.downloads.artifact.url) {
                  downloadUrl = lib.downloads.artifact.url;
                } else if (lib.name.startsWith('org.quiltmc:')) {
                  downloadUrl = this.buildQuiltMavenUrl(lib.name);
                } else if (lib.name.includes(':')) {
                  downloadUrl = this.buildMavenUrl(lib.name);
                }

                if (downloadUrl && expectedLibPath) {
                  logProgressService.info(`[Quilt] Descargando librería faltante para classpath: ${lib.name} desde ${downloadUrl}`);

                  const response = await fetch(downloadUrl, {
                    headers: { 'User-Agent': 'DRK-Launcher/1.0' }
                  });

                  if (response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());
                    const libDir = path.dirname(expectedLibPath);
                    if (!fs.existsSync(libDir)) {
                      fs.mkdirSync(libDir, { recursive: true });
                    }
                    fs.writeFileSync(expectedLibPath, buffer);

                    if (!libraryJars.includes(expectedLibPath)) {
                      libraryJars.push(expectedLibPath);
                      logProgressService.info(`[Quilt] Librería descargada y añadida al classpath: ${path.basename(expectedLibPath)} (${(buffer.length / 1024).toFixed(2)} KB)`);
                    }
                  } else {
                    logProgressService.warning(`[Quilt] No se pudo descargar librería: ${lib.name} - HTTP ${response.status}`);
                  }
                }
              } catch (error) {
                logProgressService.warning(`[Quilt] Error al descargar librería: ${lib.name} - ${error}`);
              }
            }
          }
        }
      }

      // PASO 5.7: Buscar librerías adicionales que puedan ser necesarias (como joptsimple)
      // A veces las librerías necesarias no están en el perfil principal pero son requeridas por Quilt
      logProgressService.info(`[Quilt] Buscando librerías adicionales necesarias...`);

      // Lista de librerías comunes que pueden ser necesarias
      const commonRequiredLibs = [
        'org.ow2.asm:asm:*',         // ASM principal
        'org.ow2.asm:asm-tree:*',    // ASM tree
        'org.ow2.asm:asm-util:*',    // ASM util
        'org.ow2.asm:asm-commons:*', // ASM commons
        'org.ow2.asm:asm-analysis:*' // ASM analysis
      ];

      for (const libPattern of commonRequiredLibs) {
        const [group, artifact, version] = libPattern.split(':');

        // Intentar encontrar la librería en el directorio de librerías
        const libSearchPath = path.join(launcherDataPath, 'libraries', group.replace(/\./g, '/'), artifact);

        if (fs.existsSync(libSearchPath)) {
          const files = fs.readdirSync(libSearchPath);
          for (const file of files) {
            if (file.endsWith('.jar') && file.startsWith(`${artifact}-`)) {
              const fullPath = path.join(libSearchPath, file);
              if (fs.existsSync(fullPath) && !libraryJars.includes(fullPath)) {
                libraryJars.push(fullPath);
                logProgressService.info(`[Quilt] Librería adicional encontrada y añadida al classpath: ${file}`);
              }
            }
          }
        }
      }

      // PASO 5.8: Buscar y descargar específicamente joptsimple si es necesario
      logProgressService.info(`[Quilt] Buscando librería joptsimple...`);

      const joptGroup = 'net.sf.jopt-simple';
      const joptArtifact = 'jopt-simple';
      const joptVersion = '5.0.4'; // Versión comúnmente usada
      const joptLibPath = path.join(launcherDataPath, 'libraries', joptGroup.replace(/\./g, '/'), joptArtifact, joptVersion, `${joptArtifact}-${joptVersion}.jar`);

      if (!fs.existsSync(joptLibPath)) {
        logProgressService.info(`[Quilt] joptsimple no encontrada, intentando descargar...`);

        // Intentar descargar desde Maven Central
        const joptMavenUrl = `https://repo1.maven.org/maven2/${joptGroup.replace(/\./g, '/')}/${joptArtifact}/${joptVersion}/${joptArtifact}-${joptVersion}.jar`;

        try {
          const response = await fetch(joptMavenUrl, {
            headers: { 'User-Agent': 'DRK-Launcher/1.0' }
          });

          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const libDir = path.dirname(joptLibPath);
            if (!fs.existsSync(libDir)) {
              fs.mkdirSync(libDir, { recursive: true });
            }
            fs.writeFileSync(joptLibPath, buffer);
            logProgressService.info(`[Quilt] joptsimple descargada y añadida al classpath: ${joptVersion} (${(buffer.length / 1024).toFixed(2)} KB)`);

            if (!libraryJars.includes(joptLibPath)) {
              libraryJars.push(joptLibPath);
            }
          } else {
            logProgressService.warning(`[Quilt] No se pudo descargar joptsimple: HTTP ${response.status}`);
          }
        } catch (error) {
          logProgressService.warning(`[Quilt] Error al descargar joptsimple: ${error}`);
        }
      } else {
        // Si ya existe, añadirla al classpath
        if (!libraryJars.includes(joptLibPath)) {
          libraryJars.push(joptLibPath);
          logProgressService.info(`[Quilt] joptsimple encontrada y añadida al classpath: ${path.basename(joptLibPath)}`);
        }
      }

      // PASO 6: Construir classpath
      const classpath = libraryJars.join(path.delimiter);
      logProgressService.info(`[Quilt] Classpath construido con ${libraryJars.length} JARs`);

      // PASO 7: Extraer librerías nativas si existen
      if (nativeLibraries.length > 0) {
        const nativesDir = path.join(opts.instancePath, 'natives');
        if (!fs.existsSync(nativesDir)) {
          fs.mkdirSync(nativesDir, { recursive: true });
        }

        // Limpiar directorio de nativas
        try {
          const existingFiles = fs.readdirSync(nativesDir);
          for (const file of existingFiles) {
            const filePath = path.join(nativesDir, file);
            try {
              fs.unlinkSync(filePath);
            } catch {}
          }
        } catch {}

        // Extraer archivos nativos
        for (const nativeJar of nativeLibraries) {
          if (fs.existsSync(nativeJar)) {
            try {
              const StreamZipAsync = (await import('node-stream-zip')).default;
              const zip = new StreamZipAsync.async({ file: nativeJar });
              const entries = await zip.entries();

              for (const entry of Object.values(entries) as Array<{ name: string }>) {
                if (entry && entry.name && (
                  entry.name.endsWith('.dll') ||
                  entry.name.endsWith('.so') ||
                  entry.name.endsWith('.dylib') ||
                  entry.name.endsWith('.jnilib')
                )) {
                  const extractPath = path.join(nativesDir, path.basename(entry.name));
                  await zip.extract(entry.name, extractPath);
                  logProgressService.info(`[Quilt] Extraída librería nativa: ${path.basename(entry.name)}`);
                }
              }

              await zip.close();
            } catch (extractError) {
              logProgressService.warning(`[Quilt] Error al extraer librerías nativas de ${nativeJar}: ${extractError}`);
            }
          }
        }

        jvmArgs.push('-Djava.library.path', nativesDir);
        logProgressService.info(`[Quilt] java.library.path configurado: ${nativesDir}`);
      }

      // PASO 8: Obtener mainClass (Quilt usa KnotClient)
      const mainClass = quiltVersionData.mainClass || 'org.quiltmc.loader.impl.launch.knot.KnotClient';
      logProgressService.info(`[Quilt] MainClass: ${mainClass}`);

      // PASO 9: Construir argumentos del juego
      const userUUID = opts.userProfile?.id ? ensureValidUUID(opts.userProfile.id) : ensureValidUUID('00000000-0000-0000-0000-000000000000');

      let accessToken = '0';
      let userType = 'legacy';

      if (opts.userProfile) {
        if (opts.userProfile.accessToken && opts.userProfile.accessToken !== '0' && opts.userProfile.accessToken.trim() !== '') {
          accessToken = opts.userProfile.accessToken;
          if (opts.userProfile.type === 'microsoft') {
            userType = 'mojang';
          } else if (opts.userProfile.type === 'yggdrasil' || opts.userProfile.type === 'drkauth' || opts.userProfile.type === 'elyby') {
            userType = 'mojang';
          } else {
            userType = 'legacy';
          }
        }
      }

      // Obtener assetIndexId
      let assetIndexId = opts.mcVersion;
      if (vanillaVersionData && vanillaVersionData.assetIndex && vanillaVersionData.assetIndex.id) {
        assetIndexId = vanillaVersionData.assetIndex.id;
      } else if (quiltVersionData.assetIndex && quiltVersionData.assetIndex.id) {
        assetIndexId = quiltVersionData.assetIndex.id;
      }

      // Añadir argumentos específicos para resolver el problema de mappings de Quilt
      // Si se detecta el problema de mappings intermediary, usar namespace official
      const quiltSpecificArgs = [
        // Configurar namespace de mappings para evitar el error de "intermediary"
        '-Dloader.experimental.minecraft.targetNamespace=official',
        // Opcional: Configurar para usar mappings oficiales si no hay intermediarios
        '-Dloader.use.intermediary=false'
      ];

      const gameArgs = [
        '--username', opts.userProfile?.username || 'Player',
        '--version', opts.mcVersion,
        '--gameDir', opts.instancePath,
        '--assetsDir', path.join(launcherDataPath, 'assets'),
        '--assetIndex', assetIndexId,
        '--uuid', userUUID,
        '--accessToken', accessToken,
        '--userType', userType,
        '--versionType', 'DRK Launcher (Quilt)'
      ];

      if (opts.userProfile?.clientId) {
        gameArgs.push('--clientId', opts.userProfile.clientId);
      }
      if (opts.userProfile?.xuid) {
        gameArgs.push('--xuid', opts.userProfile.xuid);
      }

      if (opts.windowSize) {
        gameArgs.push('--width', opts.windowSize.width.toString(), '--height', opts.windowSize.height.toString());
      }

      // PASO 10: Construir argumentos finales
      const launchArgs = [
        ...jvmArgs,
        ...quiltSpecificArgs,  // Añadir argumentos específicos de Quilt antes de los args del juego
        ...(opts.jvmArgs || []),
        '-cp', classpath,
        mainClass,
        ...gameArgs,
        ...(opts.gameArgs || [])
      ];

      logProgressService.info(`[Quilt] Argumentos de lanzamiento construidos exitosamente`);
      return launchArgs;
    } catch (error) {
      logProgressService.error(`[Quilt] ERROR al construir argumentos de lanzamiento: ${error}`);
      throw error;
    }
  }

  /**
   * Verifica si una librería está permitida según sus reglas
   */
  private isLibraryAllowed(rules: any[]): boolean {
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return true; // Por defecto, permitir si no hay reglas
    }

    const osName = this.getOSName();
    let allowed = false;

    for (const rule of rules) {
      const ruleOsName = rule.os?.name;
      const action = rule.action;

      if (ruleOsName) {
        // Regla específica de OS
        if (ruleOsName === osName) {
          allowed = action === 'allow';
        }
        // Si la regla es para otro OS, no la aplicamos
      } else {
        // Regla general (sin restricción de OS)
        if (action === 'allow') {
          allowed = true;
        } else if (action === 'disallow') {
          allowed = false;
        }
      }
    }

    return allowed;
  }

  /**
   * Verifica si una librería es nativa de otra plataforma
   */
  private isNativeLibraryForOtherPlatform(libraryName: string, classifiers?: any): boolean {
    const currentOs = process.platform;
    
    if (libraryName) {
      if (currentOs === 'win32') {
        return libraryName.includes(':natives-linux') || 
               libraryName.includes(':natives-macos') ||
               libraryName.includes(':natives-osx');
      }
      
      if (currentOs === 'linux') {
        return libraryName.includes(':natives-windows') || 
               libraryName.includes(':natives-macos') ||
               libraryName.includes(':natives-osx');
      }
      
      if (currentOs === 'darwin') {
        return libraryName.includes(':natives-windows') || 
               libraryName.includes(':natives-linux');
      }
    }

    return false;
  }

  /**
   * Obtiene el nombre del sistema operativo en formato Minecraft
   */
  private getOSName(): string {
    switch (process.platform) {
      case 'win32': return 'windows';
      case 'darwin': return 'osx';
      case 'linux': return 'linux';
      default: return 'linux';
    }
  }

  /**
   * Obtiene el classifier del OS para librerías nativas
   */
  private getOSClassifier(): string {
    switch (process.platform) {
      case 'win32': return 'natives-windows';
      case 'darwin': return 'natives-macos';
      case 'linux': return 'natives-linux';
      default: return 'natives-linux';
    }
  }

  /**
   * Construye la ruta de una librería basada en su nombre Maven
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
   * Detiene la ejecución del juego
   */
  detener(): void {
    if (this.gameProcess) {
      logProgressService.info(`[Quilt] Deteniendo proceso...`);
      try {
        this.gameProcess.kill();
        this.gameProcess = null;
        logProgressService.info(`[Quilt] Proceso detenido`);
      } catch (error) {
        logProgressService.error(`[Quilt] Error al detener proceso: ${error}`);
      }
    }
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
export const ejecutarQuilt = new EjecutarQuilt();

