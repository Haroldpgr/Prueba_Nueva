import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { initDB, hasDB, sqlite } from '../services/db'
import { queryStatus } from '../services/serverService'
import { launchJava } from '../services/gameService'
import { javaDetector } from './javaDetector'
// Import our Java service
import javaService from './javaService';
import fetch from 'node-fetch'; // Añadido para peticiones a la API

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
  return app.getPath('userData');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'DRK Launcher',
    backgroundColor: '#0f0f10',
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
  const instancesBaseDefault = path.join(data, 'instances')
  ensureDir(instancesBaseDefault)
  return { data, settingsPath, instancesBaseDefault }
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

function listInstances(): Instance[] {
  return readJSON<Instance[]>(instancesFile(), [])
}

function saveInstances(list: Instance[]) {
  writeJSON(instancesFile(), list)
}

function createInstance(payload: { name: string; version: string; loader?: Instance['loader'] }): Instance {
  const s = settings()
  const id = Math.random().toString(36).slice(2)
  const instPath = path.join(s.instancesBase || basePaths().instancesBaseDefault, id)
  ensureDir(instPath)
  ensureDir(path.join(instPath, 'mods'))
  ensureDir(path.join(instPath, 'resourcepacks'))
  ensureDir(path.join(instPath, 'shaderpacks'))
  ensureDir(path.join(instPath, 'config'))
  const i: Instance = { id, name: payload.name, version: payload.version, loader: payload.loader || 'vanilla', createdAt: Date.now(), path: instPath }
  const list = listInstances()
  list.push(i)
  saveInstances(list)
  return i
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


ipcMain.handle('game:launch', async (_e, p: { instanceId: string }) => {
  const i = listInstances().find(x => x.id === p.instanceId)
  const s = settings()
  if (!i) return null
  launchJava({ javaPath: s.javaPath || 'java', mcVersion: i.version, instancePath: i.path, ramMb: i.ramMb || s.defaultRamMb }, () => {}, () => {})
  return { started: true }
})

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
ipcMain.on('download:start', (event, { url, filename, itemId }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;

  const downloadsPath = app.getPath('downloads');
  const filePath = path.join(downloadsPath, filename);

  win.webContents.downloadURL(url);

  win.webContents.session.once('will-download', (e, item) => {
    item.setSavePath(filePath);

    item.on('updated', (_e, state) => {
      if (state === 'interrupted') {
        win.webContents.send('download:error', {
          itemId,
          message: 'La descarga fue interrumpida'
        });
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          win.webContents.send('download:error', {
            itemId,
            message: 'La descarga está en pausa'
          });
        } else {
          const total = item.getTotalBytes();
          const received = item.getReceivedBytes();
          const progress = total > 0 ? received / total : 0;

          win.webContents.send('download:progress', {
            itemId,
            progress
          });
        }
      }
    });

    item.once('done', (_e, state) => {
      if (state === 'completed') {
        win.webContents.send('download:complete', {
          itemId,
          filePath: item.getSavePath()
        });
      } else {
        win.webContents.send('download:error', {
          itemId,
          message: `Error en la descarga: ${state}`
        });
      }
    });
  });
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
  const projectType = modrinthProjectTypes[contentType];
  
  if (!projectType) {
    console.error('Tipo de contenido no válido para Modrinth:', contentType);
    return [];
  }

  try {
    // Construir la URL de búsqueda
    const searchParams = new URLSearchParams({
      query: search || '',
      facets: JSON.stringify([
        ["project_type:" + projectType],
        ...(modrinthLoaders[contentType].length > 0 
          ? [["categories:" + modrinthLoaders[contentType].join(" OR ")]] 
          : [])
      ]),
      limit: '20',
      index: 'relevance'
    });

    const url = `${MODRINTH_API_URL}/search?${searchParams}`;
    console.log('Buscando en Modrinth:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DRKLauncher/1.0 (haroldpgr@gmail.com)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error al buscar en Modrinth: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Error de la API de Modrinth: ${response.statusText}`);
    }

    const json = await response.json();
    
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
      version: item.latest_version || 'N/A',
      downloadUrl: item.versions && item.versions.length > 0 
        ? `https://modrinth.com/${projectType}/${item.slug}/version/${item.versions[0]}`
        : null
    }));
  } catch (error) {
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
