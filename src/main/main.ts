import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { initDB, hasDB, sqlite } from '../services/db'
import { queryStatus } from '../services/serverService'
import { launchJava, isInstanceReady } from '../services/gameService'
import { javaDetector } from './javaDetector'
// Import our Java service
import javaService from './javaService';
import fetch from 'node-fetch'; // Añadido para peticiones a la API
import { getLauncherDataPath, ensureDir as ensureDirUtil } from '../utils/paths';
import { instanceService, InstanceConfig } from '../services/instanceService';
import { instanceCreationService } from '../services/instanceCreationService';
import { modrinthDownloadService } from '../services/modrinthDownloadService';

let win: BrowserWindow | null = null;

app.whenReady().then(async () => {
  const { instancesBaseDefault } = basePaths();
  ensureDir(instancesBaseDefault);
  initDB();

  // Detect Java using the service at startup
  try {
    await javaService.detectJava();
    console.log(`Java service initialized. Found ${javaService.getAllJavas().length} Java installations.`);
  } catch (error) {
    console.error('Error initializing Java service:', error);
  }

  await createWindow();
});

function getUserDataPath() {
  // Use the centralized launcher data path utility
  return getLauncherDataPath();
}

function ensureDir(dir: string) {
  return ensureDirUtil(dir);
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'DRK Launcher',
    backgroundColor: '#0f0f10',
    autoHideMenuBar: true, // Ocultar automáticamente la barra de menú
    frame: true, // Mantener el marco para mantener la funcionalidad de ventana
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const url = process.env.VITE_DEV_SERVER_URL;
  if (url) {
    await win.loadURL(url);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(process.cwd(), 'dist', 'index.html'));
  }
}

function basePaths() {
  const data = getUserDataPath()
  const settingsPath = path.join(data, 'settings.json')
  // Directorio principal del launcher en la carpeta de roaming
  const drkLauncherDir = data  // Ya está incluido en getUserDataPath()
  ensureDir(drkLauncherDir)

  // Directorio de instancias dentro de .DRK Launcher
  // Esta es la estructura correcta para mantener instancias aisladas
  const instancesDir = path.join(drkLauncherDir, 'instances')
  ensureDir(instancesDir)

  return {
    data,
    settingsPath,
    instancesBaseDefault: instancesDir, // Instancias en la subcarpeta instances/
    // Todo se almacena en la carpeta principal del launcher o subcarpetas apropiadas
    downloadsBase: drkLauncherDir,
    versionsBase: drkLauncherDir,
    librariesBase: drkLauncherDir,
    configsBase: drkLauncherDir
  }
}

function readJSON<T>(file: string, fallback: T) {
  try {
    if (!fs.existsSync(file)) return fallback
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON(file: string, value: unknown) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(value, null, 2))
}

type Settings = {
  javaPath?: string
  defaultRamMb?: number
  theme?: 'dark' | 'light' | 'oled'
  language?: 'es' | 'en'
  instancesBase?: string
  personalizedAds?: boolean
  telemetry?: boolean
  discordRPC?: boolean
  defaultLandingPage?: 'home' | 'recent-worlds' | 'instances' | 'servers'
  jumpBackToWorlds?: boolean
  advancedRendering?: {
    renderDistance?: number
    graphics?: 'fast' | 'fancy'
    particles?: 'minimal' | 'decreased' | 'all'
    smoothLighting?: number
  }
}

type Instance = {
  id: string
  name: string
  version: string
  loader?: 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'liteloader'
  createdAt: number
  path: string
  ramMb?: number
  userProfile?: string
  ready?: boolean // Nuevo campo para indicar si la instancia está lista para jugar
}

type ServerInfo = {
  id: string
  name: string
  ip: string
  country?: string
  category?: string
  thumbnail?: string
  requiredVersion?: string
  modsHint?: string
  favorite?: boolean
}

type CrashRecord = {
  id: string
  instanceId: string
  createdAt: number
  summary: string
  logPath: string
  recommendation?: string
}

function settings(): Settings {
  const { settingsPath, instancesBaseDefault } = basePaths()
  const s = readJSON<Settings>(settingsPath, {
    theme: 'dark',
    language: 'es',
    defaultRamMb: 4096,
    instancesBase: instancesBaseDefault,
    personalizedAds: true,
    telemetry: true,
    discordRPC: true,
    defaultLandingPage: 'home',
    jumpBackToWorlds: true,
    advancedRendering: {
      renderDistance: 8,
      graphics: 'fancy',
      particles: 'all',
      smoothLighting: 2
    }
  })
  if (!s.instancesBase) s.instancesBase = instancesBaseDefault
  return s
}

function saveSettings(s: Settings) {
  const { settingsPath } = basePaths()
  writeJSON(settingsPath, s)
}

function instancesFile() {
  const { data } = basePaths()
  return path.join(data, 'instances.json')
}

// Crear una función para verificar si una instancia está completamente lista
function isInstanceFullyReady(instance: Instance): boolean {
  // Usar el servicio de instancias para verificar si está lista
  return instanceService.isInstanceReady(instance.path);
}

// Mantener la función original para compatibilidad con otros procesos internos
function listInstances(): Instance[] {
  return readJSON<Instance[]>(instancesFile(), []);
}

function saveInstances(list: Instance[]) {
  writeJSON(instancesFile(), list)
}

function createInstance(payload: { name: string; version: string; loader?: Instance['loader'] }): InstanceConfig {
  // Usar el servicio de instancias para crear una instancia con la estructura completa
  const instance = instanceService.createInstance({
    name: payload.name,
    version: payload.version,
    loader: payload.loader || 'vanilla'
  });

  // Añadir la instancia a la lista persistente
  const list = listInstances();
  const i: Instance = {
    id: instance.id,
    name: instance.name,
    version: instance.version,
    loader: instance.loader || 'vanilla',
    createdAt: instance.createdAt,
    path: instance.path
  };
  list.push(i);
  saveInstances(list);

  return i;
}

function updateInstance(id: string, patch: Partial<Instance>): Instance | null {
  const list = listInstances()
  const idx = list.findIndex(x => x.id === id)
  if (idx === -1) return null
  const updated = { ...list[idx], ...patch }
  list[idx] = updated
  saveInstances(list)
  return updated
}

function deleteInstance(id: string) {
  const list = listInstances()
  const item = list.find(x => x.id === id)
  saveInstances(list.filter(x => x.id !== id))
  if (item && fs.existsSync(item.path)) fs.rmSync(item.path, { recursive: true, force: true })
}

async function mojangVersions() {
  const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json')
  const json = await res.json()
  return json.versions as { id: string; type: string; url: string; releaseTime: string }[]
}

function analyzeLog(content: string) {
  const lower = content.toLowerCase()
  if (lower.includes('noclassdeffounderror')) return { summary: 'Falta una librería o versión incorrecta', recommendation: 'Actualizar loader o instalar dependencia faltante' }
  if (lower.includes('classnotfoundexception')) return { summary: 'Clase no encontrada', recommendation: 'Verificar versiones de mods' }
  if (lower.includes('mixin')) return { summary: 'Error de Mixin', recommendation: 'Actualizar mods y loader, revisar compatibilidad' }
  return { summary: 'Error no identificado', recommendation: 'Revisar mods recientes y memoria asignada' }
}

function crashesFile() {
  const { data } = basePaths()
  return path.join(data, 'crashes.json')
}

function listCrashes(): CrashRecord[] {
  return readJSON<CrashRecord[]>(crashesFile(), [])
}

function saveCrashes(list: CrashRecord[]) {
  writeJSON(crashesFile(), list)
}


ipcMain.handle('settings:get', async () => settings())
ipcMain.handle('settings:set', async (_e, s: Settings) => { saveSettings(s); return s })

ipcMain.handle('instances:list', async () => {
  if (hasDB()) {
    try { return sqlite().prepare('SELECT * FROM instances').all() } catch { return [] }
  }
  return listInstances()
})
ipcMain.handle('instances:create', async (_e, p: { name: string; version: string; loader?: Instance['loader'] }) => {
  const inst = createInstance(p)
  if (hasDB()) {
    try {
      sqlite().prepare('INSERT OR REPLACE INTO instances (id,name,version,loader,createdAt,path) VALUES (@id,@name,@version,@loader,@createdAt,@path)').run(inst)
    } catch {}
  }
  return inst
})
ipcMain.handle('instances:update', async (_e, p: { id: string; patch: Partial<Instance> }) => {
  const updated = updateInstance(p.id, p.patch)
  if (updated && hasDB()) {
    try { sqlite().prepare('INSERT OR REPLACE INTO instances (id,name,version,loader,createdAt,path,ramMb,userProfile) VALUES (@id,@name,@version,@loader,@createdAt,@path,@ramMb,@userProfile)').run(updated) } catch {}
  }
  return updated
})
ipcMain.handle('instances:delete', async (_e, id: string) => {
  if (hasDB()) { try { sqlite().prepare('DELETE FROM instances WHERE id = ?').run(id) } catch {} }
  deleteInstance(id); return true
})
ipcMain.handle('instances:openFolder', async (_e, id: string) => { const i = listInstances().find(x => x.id === id); if (i) shell.openPath(i.path); return true })

ipcMain.handle('versions:list', async () => mojangVersions())

ipcMain.handle('crash:analyze', async (_e, p: { instanceId: string; logPath?: string }) => {
  const i = listInstances().find(x => x.id === p.instanceId)
  if (!i) return null
  const target = p.logPath || path.join(i.path, 'logs', 'latest.log')
  if (!fs.existsSync(target)) return null
  const txt = fs.readFileSync(target, 'utf-8')
  const res = analyzeLog(txt)
  const rec: CrashRecord = { id: Math.random().toString(36).slice(2), instanceId: i.id, createdAt: Date.now(), summary: res.summary, logPath: target, recommendation: res.recommendation }
  const list = listCrashes(); list.push(rec); saveCrashes(list)
  return rec
})

ipcMain.handle('crash:list', async () => listCrashes())

ipcMain.handle('servers:list', async () => {
  const { data } = basePaths()
  const file = path.join(data, 'servers.json')
  return readJSON<ServerInfo[]>(file, [])
})

ipcMain.handle('servers:save', async (_e, list: ServerInfo[]) => {
  const { data } = basePaths()
  const file = path.join(data, 'servers.json')
  writeJSON(file, list)
  return true
})

ipcMain.handle('servers:ping', async (_e, ip: string) => queryStatus(ip))

// ... otros handlers ...

ipcMain.handle('game:launch', async (_e, p: { instanceId: string }) => {
  const i = listInstances().find(x => x.id === p.instanceId)
  const s = settings()
  if (!i) return null

  // Verificar si la instancia está completamente descargada
  if (!isInstanceReady(i.path)) {
    console.log(`La instancia ${i.name} no está lista para jugar. Archivos esenciales faltantes.`);
    throw new Error('La instancia no está completamente descargada. Espere a que terminen las descargas.')
  }

  // Usar la configuración de la instancia si está disponible
  const instanceConfig = instanceService.getInstanceConfig(i.path);
  const ramMb = instanceConfig?.maxMemory || i.ramMb || s.defaultRamMb;
  const javaPath = instanceConfig?.javaPath || s.javaPath || 'java';

  launchJava({
    javaPath: javaPath,
    mcVersion: i.version,
    instancePath: i.path,
    ramMb: ramMb
  }, () => {}, () => {})

  return { started: true }
})

// --- IPC Handlers for Instance Creation --- //
ipcMain.handle('instance:create-full', async (_e, payload: { name: string; version: string; loader?: Instance['loader']; javaVersion?: string }) => {
  try {
    const instance = await instanceCreationService.createFullInstance(
      payload.name,
      payload.version,
      payload.loader || 'vanilla',
      payload.javaVersion || '17'
    );
    return instance;
  } catch (error) {
    console.error('Error creating full instance:', error);
    throw error;
  }
});

ipcMain.handle('instance:install-content', async (_e, payload: {
  instancePath: string;
  contentId: string;
  contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'modpack';
  mcVersion: string;
  loader?: string;
  versionId?: string;  // Nuevo parámetro para versión específica
}) => {
  try {
    if (payload.contentType === 'modpack') {
      // Para modpacks, usar el método existente
      await instanceCreationService.installContentToInstance(
        payload.instancePath,
        payload.contentId,
        payload.contentType,
        payload.mcVersion,
        payload.loader
      );
    } else {
      // Para otros contenidos, usar el nuevo método con selección de versión
      await modrinthDownloadService.downloadContent(
        payload.contentId,
        payload.instancePath,
        payload.mcVersion,
        payload.loader,
        payload.contentType,
        payload.versionId  // Pasar el ID de versión específico si se proporcionó
      );
    }
    return { success: true };
  } catch (error) {
    console.error('Error installing content to instance:', error);
    throw error;
  }
});

ipcMain.handle('instance:is-complete', async (_e, instancePath: string) => {
  return instanceCreationService.isInstanceComplete(instancePath);
});

// --- IPC Handlers for Download Management --- //
ipcMain.handle('downloads:get-all', async () => {
  return downloadQueueService.getAllDownloads();
});

ipcMain.handle('downloads:get-status', async (_e, downloadId: string) => {
  return downloadQueueService.getDownloadStatus(downloadId);
});

ipcMain.handle('downloads:cancel', async (_e, downloadId: string) => {
  return downloadQueueService.cancelDownload(downloadId);
});

ipcMain.handle('downloads:restart', async (_e, downloadId: string) => {
  const result = await downloadQueueService.restartDownload(downloadId);
  return result !== null;
});

// --- IPC Handlers for Mod Versions --- //
ipcMain.handle('modrinth:get-versions', async (_e, projectId: string) => {
  return await modrinthDownloadService.getAvailableVersions(projectId);
});

ipcMain.handle('modrinth:get-compatible-versions', async (_e, payload: {
  projectId: string,
  mcVersion: string,
  loader?: string
}) => {
  return await modrinthDownloadService.getCompatibleVersions(
    payload.projectId,
    payload.mcVersion,
    payload.loader
  );
});

// --- IPC Handlers for Dialog --- //
ipcMain.handle('dialog:showOpenDialog', async (_e, options: any) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(options);
    return result;
  } catch (error) {
    console.error('Error en showOpenDialog:', error);
    return { canceled: true, filePaths: [] };
  }
});


// --- IPC Handlers for Java --- //
ipcMain.handle('java:detect', async () => {
  try {
    return await javaService.detectJava();
  } catch (error) {
    console.error('Error detecting Java:', error);
    return [];
  }
});

ipcMain.handle('java:get-all', async () => {
  return javaService.getAllJavas();
});

ipcMain.handle('java:get-default', async () => {
  return javaService.getDefaultJava();
});

ipcMain.handle('java:set-default', async (_event, javaId: string) => {
  return javaService.setDefaultJava(javaId);
});

ipcMain.handle('java:remove', async (_event, javaId: string) => {
  return javaService.removeInstalledJava(javaId);
});

ipcMain.handle('java:test', async (_event, javaPath: string) => {
  try {
    const isWorking = await javaService.testJava(javaPath);
    return { isWorking };
  } catch (error) {
    return { isWorking: false, error: (error as Error).message };
  }
});

ipcMain.handle('java:get-compatibility', async (_event, minecraftVersion: string) => {
  return javaService.getMinecraftJavaCompatibility(minecraftVersion);
});

ipcMain.handle('java:explore', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Java Executable', extensions: [process.platform === 'win32' ? 'exe' : ''] },
      { name: 'All Files', extensions: ['*'] }
    ],
    title: 'Seleccionar archivo ejecutable de Java'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});


// ===== MANEJO DE DESCARGAS =====
import fs from 'node:fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import fetch from 'node-fetch';

const pipelineAsync = promisify(pipeline);

// Función para limpiar nombres de archivos y rutas
function sanitizeFileName(fileName: string): string {
  // Reemplazar caracteres problemáticos
  return fileName
    .replace(/[:<>|*?"]/g, '_')  // Reemplazar caracteres prohibidos en Windows
    .replace(/@/g, '_at_')       // Reemplazar @
    .replace(/:/g, '_');         // Reemplazar dos puntos específicamente
}

ipcMain.on('download:start', async (event, { url, filename, itemId }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;

  // Limpiar el nombre de archivo para evitar caracteres problemáticos
  const cleanFilename = sanitizeFileName(filename);

  // Guardar en el directorio principal del launcher (.DRK Launcher)
  const { downloadsBase } = basePaths();
  const downloadPath = downloadsBase; // Usar la carpeta principal del launcher
  ensureDir(downloadPath);

  // Crear la ruta completa del archivo y asegurarse de que los directorios existan
  const filePath = path.join(downloadPath, cleanFilename);
  const fileDir = path.dirname(filePath);
  ensureDir(fileDir); // Asegurar que el directorio del archivo exista

  try {
    // Realizar la descarga usando fetch y streams para evitar ventanas emergentes
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;

    // Crear un stream de escritura para el archivo
    const fileStream = fs.createWriteStream(filePath);

    // Controlar el progreso de la descarga
    const progressStream = new (require('stream').Transform)({
      transform(chunk, encoding, callback) {
        downloadedBytes += chunk.length;
        const progress = totalBytes > 0 ? downloadedBytes / totalBytes : 0;

        // Enviar progreso al frontend
        win.webContents.send('download:progress', {
          itemId,
          progress
        });

        callback(null, chunk);
      }
    });

    // Conectar los streams
    response.body
      .pipe(progressStream)
      .pipe(fileStream);

    // Esperar a que la descarga termine
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      progressStream.on('error', reject);
    });

    // Enviar evento de descarga completada
    win.webContents.send('download:complete', {
      itemId,
      filePath
    });

    // Lógica para mover archivos a sus ubicaciones correctas si son archivos esenciales
    try {
      // Solo procesar si el archivo contiene información sobre versiones de Minecraft
      if (cleanFilename.includes('versions') && cleanFilename.includes('.jar')) {
        // Capturar información de la versión del nombre del archivo
        // Ejemplo: versions/1.21.1/1.21.1.jar
        const jarMatch = cleanFilename.match(/versions[\/\\]?([^\/\\]+)[\/\\]([^\/\\]+\.jar)/);
        if (jarMatch) {
          const [, versionId, jarFileName] = jarMatch;

          // Buscar instancia que coincida con esta versión
          const allInstances = listInstances();
          const targetInstance = allInstances.find(instance =>
            instance.version === versionId
          );

          if (targetInstance) {
            // Mover archivo al directorio de la instancia con el nombre client.jar
            const targetPath = path.join(targetInstance.path, 'client.jar');
            ensureDir(path.dirname(targetPath));
            fs.copyFileSync(filePath, targetPath);
            console.log(`Archivo ${jarFileName} renombrado a client.jar y movido a la instancia ${targetInstance.id}`);
          }
        }
      }
    } catch (moveError) {
      console.error('Error al mover archivo a destino final:', moveError);
    }
  } catch (error) {
    console.error(`Error downloading ${url}:`, error);
    win.webContents.send('download:error', {
      itemId,
      message: `Error en la descarga: ${(error as Error).message}`
    });
  }
});

// --- Modrinth API Integration --- //
const MODRINTH_API_URL = 'https://api.modrinth.com/v2';

// Mapeo de nuestros tipos a los tipos de proyecto de Modrinth
const modrinthProjectTypes = {
  modpacks: 'modpack',
  mods: 'mod',
  resourcepacks: 'resourcepack',
  datapacks: 'datapack',
  shaders: 'shader'
};

// Mapeo de tipos de carga (loaders) para Modrinth
const modrinthLoaders = {
  modpacks: ['forge', 'fabric', 'quilt', 'neoforge'],
  mods: ['forge', 'fabric', 'quilt', 'neoforge'],
  resourcepacks: [],
  datapacks: [],
  shaders: ['iris', 'optifine']
};

async function fetchModrinthContent(contentType: keyof typeof modrinthProjectTypes, search: string) {
  let facets: string[][];

  // Estructura correcta de facetas para la API de Modrinth
  if (contentType === 'modpacks') {
    facets = [["project_type:modpack"]];
  } else if (contentType === 'mods') {
    facets = [["project_type:mod"]];
  } else if (contentType === 'resourcepacks') {
    facets = [["project_type:resourcepack"]];
  } else if (contentType === 'datapacks') {
    facets = [["project_type:datapack"]];
  } else if (contentType === 'shaders') {
    facets = [["project_type:shader"]];
  } else {
    console.error('Tipo de contenido no válido para Modrinth:', contentType);
    return [];
  }

  try {
    // Si no hay término de búsqueda, obtener contenido popular por tipo
    const searchParams = new URLSearchParams({
      query: search || '', // Puede ser vacío para obtener resultados generales
      facets: JSON.stringify(facets),
      limit: '100', // Aumentar a 100 resultados por página
      index: search ? 'relevance' : 'downloads' // Ordenar por descargas si no hay búsqueda específica
    });

    const url = `${MODRINTH_API_URL}/search?${searchParams}`;
    console.log('Buscando en Modrinth:', url);

    // Aumentar el timeout de la solicitud
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'DRKLauncher/1.0 (haroldpgr@gmail.com)',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error al buscar en Modrinth: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Error de la API de Modrinth: ${response.statusText}`);
    }

    const json = await response.json();
    console.log('Respuesta de Modrinth:', json); // Debug log

    // Verificar si hay resultados válidos
    if (!json || !json.hits || !Array.isArray(json.hits)) {
      console.warn('La respuesta de Modrinth no contiene resultados válidos:', json);
      return [];
    }

    // Mapear la respuesta de Modrinth a nuestro formato
    return json.hits.map((item: any) => ({
      id: item.project_id || item.id,
      title: item.title,
      description: item.description,
      author: item.author || 'Desconocido',
      downloads: item.downloads || 0,
      lastUpdated: item.date_modified || item.updated,
      minecraftVersions: item.versions || [],
      categories: item.categories || [],
      imageUrl: item.icon_url || 'https://via.placeholder.com/400x200',
      type: contentType,
      version: item.versions && item.versions.length > 0 ? item.versions[0] : 'N/A',
      downloadUrl: item.project_id && item.versions && item.versions.length > 0
        ? `${MODRINTH_API_URL}/project/${item.project_id}/version/${item.versions[0]}`
        : null
    }));
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('La solicitud a Modrinth ha expirado:', error);
      throw new Error('La solicitud a Modrinth ha tardado demasiado en responder');
    }
    console.error('Fallo al obtener datos de Modrinth:', error);
    return []; // Devolver un array vacío en caso de error
  }
}

// Manejador IPC para búsquedas de Modrinth
ipcMain.handle('modrinth:search', async (_event, { contentType, search }) => {
  return fetchModrinthContent(contentType, search);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
