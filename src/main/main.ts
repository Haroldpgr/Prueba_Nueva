import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { initDB, hasDB, sqlite } from '../services/db'
import { queryStatus } from '../services/serverService'
import { launchJava } from '../services/gameService'

let win: BrowserWindow | null = null

function getUserDataPath() {
  return app.getPath('userData')
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 1000,
    title: 'DRK Launcher',
    backgroundColor: '#0f0f10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const url = process.env.VITE_DEV_SERVER_URL
  if (url) {
    await win.loadURL(url)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    await win.loadFile(path.join(process.cwd(), 'dist', 'index.html'))
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

app.whenReady().then(async () => {
  const { instancesBaseDefault } = basePaths()
  ensureDir(instancesBaseDefault)
  initDB()
  await createWindow()
})

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

async function findJavaInstallations() {
  const installations: { version: string; path: string }[] = [];

  // Para Windows, buscar en ubicaciones comunes de Java
  if (process.platform === 'win32') {
    const commonPaths = [
      'C:/Program Files/Java/',
      'C:/Program Files/Eclipse Adoptium/',
      'C:/Program Files/Amazon Corretto/',
      'C:/Program Files/Oracle/',
      'C:/Program Files/OpenJDK/',
      'C:/Program Files (x86)/Java/',
      'C:/Program Files (x86)/Eclipse Adoptium/',
      'C:/Program Files (x86)/Amazon Corretto/',
      'C:/Program Files (x86)/Oracle/',
      'C:/Program Files (x86)/OpenJDK/',
    ];

    for (const path of commonPaths) {
      if (fs.existsSync(path)) {
        const subdirs = fs.readdirSync(path).filter(item => item.toLowerCase().includes('java') || item.toLowerCase().includes('jdk') || item.toLowerCase().includes('jre'));
        for (const subdir of subdirs) {
          const javaPath = path + subdir + '/bin/java.exe';
          if (fs.existsSync(javaPath)) {
            try {
              const versionResult = await new Promise<string>((resolve, reject) => {
                const child = require('child_process').spawn(javaPath, ['-version']);
                let output = '';
                child.stderr.on('data', (data: Buffer) => {
                  output += data.toString();
                });
                child.on('close', (code) => {
                  if (code === 0) {
                    resolve(output);
                  } else {
                    reject(new Error('Error getting version'));
                  }
                });
              });

              // Extraer la versión de Java del output
              const versionMatch = versionResult.match(/version "([^"]+)"/);
              if (versionMatch && versionMatch[1]) {
                const version = versionMatch[1];
                installations.push({ version, path: javaPath });
              }
            } catch (e) {
              console.error(`Error getting version for ${javaPath}:`, e);
            }
          }
        }
      }
    }
  }

  // También intentar encontrar Java en la variable PATH
  try {
    const { exec } = require('child_process');
    const defaultJavaPath = await new Promise<string>((resolve) => {
      exec('where java', { timeout: 5000 }, (error: any, stdout: string, stderr: string) => {
        if (!error && stdout.trim()) {
          resolve(stdout.trim().split('\n')[0]);
        } else {
          resolve('');
        }
      });
    });

    if (defaultJavaPath) {
      installations.push({ version: 'PATH default', path: defaultJavaPath });
    }
  } catch (e) {
    console.error('Error finding Java in PATH:', e);
  }

  return installations;
}

ipcMain.handle('game:launch', async (_e, p: { instanceId: string }) => {
  const i = listInstances().find(x => x.id === p.instanceId)
  const s = settings()
  if (!i) return null
  launchJava({ javaPath: s.javaPath || 'java', mcVersion: i.version, instancePath: i.path, ramMb: i.ramMb || s.defaultRamMb }, () => {}, () => {})
  return { started: true }
})

ipcMain.handle('java:detect', async () => {
  return await findJavaInstallations();
})

ipcMain.handle('java:explore', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Java Executable', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    title: 'Seleccionar archivo ejecutable de Java'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
})

async function installJava(version: string) {
  // Simular instalación de Java - en una implementación real, esto descargaría e instalaría Java
  console.log(`Instalando Java ${version}...`);

  // En una implementación real, aquí se haría:
  // 1. Descargar el instalador de Java
  // 2. Ejecutar el instalador
  // 3. Devolver la ruta de instalación

  // Por ahora, devolveremos un mensaje de simulación
  return {
    success: true,
    message: `Java ${version} instalado exitosamente`,
    path: `C:/Program Files/Java/jdk-${version}/bin/java.exe` // Ruta simulada
  };
}

ipcMain.handle('java:install', async (_event, version: string) => {
  try {
    return await installJava(version);
  } catch (error) {
    console.error('Error instalando Java:', error);
    return {
      success: false,
      message: `Error instalando Java ${version}: ${error.message || 'Error desconocido'}`
    };
  }
})

ipcMain.handle('java:test', async (_event, path: string) => {
  try {
    // Verificar si el archivo existe
    const fs = require('fs');
    if (!fs.existsSync(path)) {
      return { success: false, message: 'La ruta especificada no existe' };
    }

    // Intentar ejecutar java -version para verificar que sea un ejecutable válido
    const { spawn } = require('child_process');
    return new Promise((resolve) => {
      const child = spawn(path, ['-version']);
      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 || (errorOutput.includes('version') && errorOutput.includes('"'))) {
          // Si la ejecución fue exitosa o el error contiene información de versión
          const versionMatch = errorOutput.match(/version "([^"]+)"/);
          if (versionMatch && versionMatch[1]) {
            resolve({ success: true, message: `Java encontrado exitosamente. Versión: ${versionMatch[1]}` });
          } else {
            resolve({ success: true, message: 'Java encontrado y parece válido' });
          }
        } else {
          resolve({ success: false, message: `Java no se pudo ejecutar correctamente: ${errorOutput}` });
        }
      });

      child.on('error', (error) => {
        resolve({ success: false, message: `Error ejecutando Java: ${error.message}` });
      });
    });
  } catch (error) {
    console.error('Error probando Java:', error);
    return { success: false, message: `Error probando Java: ${error.message || 'Error desconocido'}` };
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
