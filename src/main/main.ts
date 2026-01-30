import { app, BrowserWindow, ipcMain, shell, session, globalShortcut } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import http from 'node:http'
import { URL } from 'node:url'
import { initDB, hasDB, sqlite } from '../services/db'
import { queryStatus } from '../services/serverService'
import { launchJava as originalLaunchJava, isInstanceReady, areAssetsReadyForVersion, ensureClientJar } from '../services/gameService'
import { javaDetector } from './javaDetector'
// Import our Java service
import javaService from './javaService';
import fetch from 'node-fetch'; // Añadido para peticiones a la API
import { getLauncherDataPath, ensureDir as ensureDirUtil } from '../utils/paths';
import { ensureValidUUID } from '../utils/uuid';
import { instanceService, InstanceConfig } from '../services/instanceService';
import { instanceCreationService } from '../services/instanceCreationService';
import { modrinthDownloadService } from '../services/modrinthDownloadService';
import { curseforgeService } from '../services/curseforgeService';
import { downloadQueueService } from '../services/downloadQueueService';
import { enhancedInstanceCreationService } from '../services/enhancedInstanceCreationService';
import { versionService } from '../services/versionService';
import { javaDownloadService } from '../services/javaDownloadService';
import { loaderService } from '../services/loaderService';
import { logProgressService } from '../services/logProgressService';
import { gameLaunchService } from '../services/gameLaunchService';
import { gameLogsService } from '../services/gameLogsService';
import { tempModpackService } from '../services/tempModpackService';
import { fileAnalyzerService } from '../services/fileAnalyzerService';
import { YggdrasilClient, yggdrasilClient } from './yggdrasilClient';
import { DrkAuthClient, drkAuthClient } from './drkAuthClient';
import { MicrosoftAuthClient, microsoftAuthClient } from './microsoftAuthClient';
import { ModDetectionService } from '../services/modDetectionService';
import { ModDiagnosticService } from '../services/modDiagnosticService';
import { ModCompatibilityService } from '../services/modCompatibilityService';
import { initializeUpdater, registerUpdaterHandlers } from './updaterService';

let win: BrowserWindow | null = null;

app.whenReady().then(async () => {
  const { instancesBaseDefault } = basePaths();
  ensureDir(instancesBaseDefault);
  
  // Verificar que los datos del usuario estén intactos después de una actualización
  try {
    const launcherDataPath = getLauncherDataPath();
    console.log('[Main] Directorio de datos del launcher:', launcherDataPath);
    
    // Verificar que el directorio existe (se creará si no existe)
    if (!fs.existsSync(launcherDataPath)) {
      console.log('[Main] Creando directorio de datos del launcher...');
      ensureDirUtil(launcherDataPath);
    }
    
    // Verificar base de datos
    const dbPath = path.join(launcherDataPath, 'drk.sqlite');
    if (fs.existsSync(dbPath)) {
      console.log('[Main] ✓ Base de datos encontrada y preservada después de la actualización');
    } else {
      console.log('[Main] Base de datos no existe aún (primera ejecución o nueva instalación)');
    }
    
    // Verificar instancias
    const instancesPath = path.join(launcherDataPath, 'instances');
    if (fs.existsSync(instancesPath)) {
      const instances = fs.readdirSync(instancesPath);
      console.log(`[Main] ✓ ${instances.length} instancia(s) encontrada(s) y preservada(s)`);
    }
    
    console.log('[Main] ✓ Todos los datos del usuario están intactos');
  } catch (err) {
    console.error('[Main] Error al verificar datos del usuario:', err);
  }
  
  initDB();

  // Registrar handlers de actualizaciones
  registerUpdaterHandlers();

  // Registrar protocolo personalizado para OAuth callback de Ely.by
  if (!app.isDefaultProtocolClient('elyby')) {
    app.setAsDefaultProtocolClient('elyby');
  }

  // Detect Java using the service at startup
  try {
    await javaService.detectJava();
    console.log(`Java service initialized. Found ${javaService.getAllJavas().length} Java installations.`);
  } catch (error) {
    console.error('Error initializing Java service:', error);
  }

  await createWindow();
  
  // En producción: permitir DevTools con Ctrl+Shift+M para debugging
  if (!process.env.VITE_DEV_SERVER_URL) {
    // Bloquear atajos estándar de DevTools
    globalShortcut.register('CommandOrControl+Shift+I', () => {});
    globalShortcut.register('F12', () => {});
    globalShortcut.register('CommandOrControl+Shift+J', () => {});
    globalShortcut.register('CommandOrControl+Shift+C', () => {});
    
    // Permitir Ctrl+Shift+M para abrir DevTools (atajo personalizado para debugging)
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      if (win && !win.isDestroyed()) {
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools();
          console.log('[Main] DevTools cerrado');
        } else {
          win.webContents.openDevTools({ mode: 'detach' });
          console.log('[Main] DevTools abierto con Ctrl+Shift+M');
        }
      }
    });
    
    console.log('[Main] DevTools disponible con Ctrl+Shift+M para debugging');
  }
  
  // Manejar URLs de protocolo personalizado (para OAuth callback)
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleOAuthProtocol(url);
  });
});

// Manejar URLs del protocolo elyby://
function handleOAuthProtocol(url: string) {
  console.log('[Ely.by OAuth] URL recibida:', url);
  // Esto se manejará en el handler IPC cuando se abra la ventana
}

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
    closable: true, // CRÍTICO: Asegurar que la ventana sea cerrable para que las actualizaciones funcionen
    icon: path.join(__dirname, '..', '..', '..', 'Icono', 'Logo.png'), // Ruta simple al icono
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true // Habilitar DevTools para poder abrir con Ctrl+Shift+M
    }
  });

  // Deshabilitar menú contextual en producción
  if (!process.env.VITE_DEV_SERVER_URL) {
    win.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

  const url = process.env.VITE_DEV_SERVER_URL;
  if (url) {
    await win.loadURL(url);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // En producción, los archivos están en app.asar
    // app.getAppPath() devuelve la ruta correcta tanto en desarrollo como en producción
    const htmlPath = path.join(app.getAppPath(), 'dist', 'index.html');
    await win.loadFile(htmlPath);
  }

  // Inicializar sistema de actualizaciones automáticas
  initializeUpdater(win);
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
  loader?: 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge'
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
    loader: payload.loader || 'vanilla',
    id: undefined
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

function deleteCrash(crashId: string): boolean {
  const crashes = listCrashes();
  const initialLength = crashes.length;
  const updatedCrashes = crashes.filter(crash => crash.id !== crashId);

  if (initialLength !== updatedCrashes.length) {
    saveCrashes(updatedCrashes);
    return true; // Se eliminó correctamente
  }

  return false; // No se encontró el crash
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

// Handler para abrir carpeta desde una ruta de archivo
ipcMain.handle('shell:showItemInFolder', async (_e, filePath: string) => {
  try {
    shell.showItemInFolder(filePath);
    return true;
  } catch (error) {
    console.error('Error opening folder:', error);
    return false;
  }
});

// Handler para abrir una ruta de carpeta
ipcMain.handle('shell:openPath', async (_e, folderPath: string) => {
  try {
    await shell.openPath(folderPath);
    return true;
  } catch (error) {
    console.error('Error opening path:', error);
    return false;
  }
});

// Handler para abrir URL externa
ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error: any) {
    console.error('[Shell] Error al abrir URL externa:', error);
    return { success: false, error: error.message };
  }
});

// Handlers para información de la aplicación
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getName', () => {
  return app.getName();
});

// Handlers para información del sistema operativo
ipcMain.handle('os:platform', () => {
  return os.platform();
});

ipcMain.handle('os:arch', () => {
  return os.arch();
});

ipcMain.handle('os:release', () => {
  return os.release();
});

// Handler para enviar feedback por correo
ipcMain.handle('feedback:send', async (_e, data: { to: string; subject: string; body: string; type: string; userEmail?: string }) => {
  try {
    // Usar nodemailer para enviar correo directamente
    const nodemailer = require('nodemailer');
    
    // Configurar transporter usando Gmail SMTP
    // Nota: En producción, deberías usar variables de entorno para las credenciales
    // Por ahora, usaremos un servicio web API como alternativa más segura
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'darkyvastudio@gmail.com', // Cambiar por credenciales de aplicación
        pass: process.env.GMAIL_APP_PASSWORD || '' // Usar contraseña de aplicación de Gmail
      }
    });

    // Si no hay contraseña configurada, usar servicio web alternativo
    if (!process.env.GMAIL_APP_PASSWORD) {
      return await sendFeedbackViaWebAPI(data);
    }

    // Enviar correo
    const mailOptions = {
      from: 'darkyvastudio@gmail.com',
      to: data.to,
      subject: data.subject,
      text: data.body,
      html: formatEmailHTML(data.body, data.type)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Feedback] Correo enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[Feedback] Error al enviar correo:', error);
    // Intentar con servicio web como fallback
    try {
      return await sendFeedbackViaWebAPI(data);
    } catch (fallbackError) {
      console.error('[Feedback] Error en fallback:', fallbackError);
      return { success: false, error: error.message || 'Error desconocido' };
    }
  }
});

// Función para enviar feedback usando servicio web API (alternativa)
async function sendFeedbackViaWebAPI(data: { to: string; subject: string; body: string; type: string; userEmail?: string }) {
  try {
    // Usar un servicio web como FormSubmit.co o crear tu propio endpoint
    // Por ahora, usaremos una solución simple con fetch
    const response = await fetch('https://formsubmit.co/ajax/darkyvastudio@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: data.userEmail ? `Usuario: ${data.userEmail}` : 'DRK Launcher User',
        email: data.userEmail || 'noreply@drklauncher.com',
        subject: data.subject,
        message: data.body,
        _template: 'box',
        _captcha: false,
        _replyto: data.userEmail || undefined
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Feedback] Enviado vía FormSubmit:', result);
      return { success: true };
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error: any) {
    console.error('[Feedback] Error en servicio web:', error);
    throw error;
  }
}

// Función para formatear el correo en HTML
function formatEmailHTML(body: string, type: string): string {
  const typeLabels: Record<string, string> = {
    'bug': '🐛 Reporte de Error',
    'feature': '💡 Sugerencia de Funcionalidad',
    'improvement': '✨ Mejora de Funcionalidad',
    'modpack': '📦 Solicitud de Modpack',
    'performance': '⚡ Problema de Rendimiento',
    'ui': '🎨 Mejora de Interfaz',
    'other': '📝 Otro Asunto'
  };

  const typeLabel = typeLabels[type] || 'Consulta General';
  const htmlBody = body.replace(/\n/g, '<br>');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .type-badge { display: inline-block; background: #667eea; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; margin-bottom: 15px; }
        .message { background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #667eea; margin: 15px 0; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Nuevo Feedback de DRK Launcher</h2>
        </div>
        <div class="content">
          <div class="type-badge">${typeLabel}</div>
          <div class="message">
            ${htmlBody}
          </div>
        </div>
        <div class="footer">
          <p>Este mensaje fue enviado automáticamente desde DRK Launcher.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

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

ipcMain.handle('crash:delete', async (_, id: string) => {
  // Intentar eliminar el crash
  const deleted = deleteCrash(id);

  // Si se eliminó con éxito, borrar también el archivo de log asociado si existe
  if (deleted) {
    const crash = listCrashes().find(c => c.id === id);
    if (crash && crash.logPath && fs.existsSync(crash.logPath)) {
      try {
        fs.unlinkSync(crash.logPath); // Eliminar archivo físico del log
      } catch (error) {
        console.error(`Error al eliminar archivo de log: ${crash.logPath}`, error);
        // Continuar igual, aunque no se pueda eliminar el archivo físico
      }
    }
  }

  return deleted;
})

// Nuevo handler para leer archivos de log
ipcMain.handle('logs:readLog', async (_e, logPath: string) => {
  try {
    // Validar que la ruta del archivo esté dentro de directorios permitidos
    const { data } = basePaths();
    const instancesPath = path.join(data, 'instances');

    // Asegurarse de que el path esté dentro del directorio de instancias
    const resolvedPath = path.resolve(logPath);
    const resolvedInstancesPath = path.resolve(instancesPath);

    if (!resolvedPath.startsWith(resolvedInstancesPath)) {
      throw new Error('Ruta de archivo no permitida');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error('El archivo de log no existe');
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error al leer archivo de log:', error);
    throw error;
  }
})

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

// Definir tipo para el perfil de usuario que puede ser enviado desde el renderer
type UserProfile = {
  id: string;
  username: string;
  type: 'microsoft' | 'non-premium';
  lastUsed: number;
  gameTime?: number;
  instances?: string[];
  skinUrl?: string;
};

// CRÍTICO: Protección contra ejecuciones múltiples del mismo juego
const activeLaunches = new Map<string, boolean>();
// Mapa para almacenar los procesos de juego activos por instancia
const activeGameProcesses = new Map<string, import('child_process').ChildProcess>();

ipcMain.handle('game:launch', async (_e, p: { instanceId: string, userProfile?: UserProfile }) => {
  // CRÍTICO: Obtener información del proceso que está llamando
  const callerStack = new Error().stack;
  const callerInfo = callerStack?.split('\n').slice(1, 4).join('\n') || 'Desconocido';
  
  logProgressService.info(`[GameLaunch] ===== SOLICITUD DE LANZAMIENTO RECIBIDA =====`);
  logProgressService.info(`[GameLaunch] Instancia ID: ${p.instanceId}`);
  logProgressService.info(`[GameLaunch] Timestamp: ${new Date().toISOString()}`);
  logProgressService.info(`[GameLaunch] Información del llamador:`, { callerStack: callerInfo });
  
  const i = listInstances().find(x => x.id === p.instanceId)
  const s = settings()
  if (!i) {
    logProgressService.error(`[GameLaunch] ❌ Instancia no encontrada: ${p.instanceId}`);
    return null;
  }

  // CRÍTICO: Verificar si ya hay un lanzamiento en progreso para esta instancia
  if (activeLaunches.get(i.id)) {
    logProgressService.warning(`[GameLaunch] ⚠️ BLOQUEADO: Ya hay un lanzamiento en progreso para la instancia ${i.name}.`, {
      instanceId: i.id,
      callerInfo: callerInfo
    });
    logProgressService.warning(`[GameLaunch] Esta solicitud fue bloqueada. Llamado desde:`, { callerStack: callerInfo });
    return { started: false, reason: 'Ya hay un lanzamiento en progreso' };
  }

  // Marcar que hay un lanzamiento en progreso
  activeLaunches.set(i.id, true);
  logProgressService.info(`[GameLaunch] ✓ Flag de lanzamiento activado para instancia: ${i.id}`);

  // Registrar inicio del proceso de lanzamiento
  logProgressService.launch(`Iniciando lanzamiento de la instancia ${i.name}`, {
    instanceId: i.id,
    version: i.version,
    loader: i.loader,
    callerInfo: callerInfo
  });

  try {
    // Asegurar que el client.jar esté disponible antes de verificar si la instancia está lista
    const clientJarReady = await ensureClientJar(i.path, i.version);
    if (!clientJarReady) {
      const errorMsg = `No se pudo asegurar el archivo client.jar para la instancia ${i.name}.`;
      logProgressService.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Verificar si la instancia está completamente descargada (ahora client.jar debería estar presente)
    if (!isInstanceReady(i.path)) {
      const errorMsg = `La instancia ${i.name} no está lista para jugar. Archivos esenciales faltantes.`;
      logProgressService.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Verificar si los assets necesarios para la versión están disponibles
    // IMPORTANTE: Esta verificación se hace con tolerancia ya que Minecraft puede descargar assets faltantes en tiempo de ejecución
    const assetsReady = areAssetsReadyForVersion(i.path, i.version);
    if (!assetsReady) {
      logProgressService.warning(`Advertencia: Los assets para la versión ${i.version} pueden no estar completamente descargados, pero se intentará iniciar el juego.`);
      // No lanzar error, permitir que el juego se inicie y descargue assets según sea necesario
    }

    // Usar la configuración de la instancia si está disponible
    const instanceConfig = instanceService.getInstanceConfig(i.path);
    const ramMb = instanceConfig?.maxMemory || i.ramMb || s.defaultRamMb;
    const javaPath = instanceConfig?.javaPath || s.javaPath || 'java';
    const windowWidth = instanceConfig?.windowWidth || 1280;
    const windowHeight = instanceConfig?.windowHeight || 720;
    const jvmArgs = instanceConfig?.jvmArgs || [];

    // Obtener el JRE recomendado para esta versión de Minecraft
    let finalJavaPath = javaPath;

    // Función auxiliar para extraer la versión de Java de una ruta
    const getJavaVersionFromPath = (path: string): number | null => {
      // Buscar patrones como java8, java17, java21 en la ruta
      const match = path.match(/java(\d+)/i);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      return null;
    };

    // Si no hay javaPath o es 'java', usar la versión recomendada
    if (!javaPath || javaPath === 'java') {
      finalJavaPath = await javaDownloadService.getJavaForMinecraftVersion(i.version);
    } else {
      // Si ya hay un javaPath, verificar si es compatible con la versión de Minecraft
      const recommendedJavaPath = await javaDownloadService.getJavaForMinecraftVersion(i.version);

      const currentVersion = getJavaVersionFromPath(javaPath);
      const recommendedVersion = getJavaVersionFromPath(recommendedJavaPath);

      if (currentVersion !== null && recommendedVersion !== null) {
        // Si la versión recomendada es mayor que la actual, usar la recomendada
        if (recommendedVersion > currentVersion) {
          logProgressService.info(`Versión de Java actual (${currentVersion}) es menor que la recomendada (${recommendedVersion}) para Minecraft ${i.version}, actualizando...`, {
            currentVersion,
            recommendedVersion
          });
          finalJavaPath = recommendedJavaPath;
        } else {
          logProgressService.info(`Versión de Java actual (${currentVersion}) es adecuada para Minecraft ${i.version}`, {
            currentVersion,
            recommendedVersion
          });
        }
      } else {
        // Si no podemos determinar la versión, usar la recomendada
        finalJavaPath = recommendedJavaPath;
        logProgressService.warning(`No se pudo determinar la versión de Java, usando recomendada`, {
          javaPath,
          recommendedJavaPath
        });
      }
    }

    logProgressService.info(`Usando Java en: ${finalJavaPath}`, { javaPath: finalJavaPath });

    // Asegurar que el UUID en el perfil de usuario sea válido antes de pasarlo al juego
    let validatedUserProfile = p.userProfile;
    if (p.userProfile && p.userProfile.id) {
      validatedUserProfile = {
        ...p.userProfile,
        id: ensureValidUUID(p.userProfile.id)
      };
      
      // Log de depuración para verificar el perfil
      logProgressService.info(`Perfil de usuario para lanzamiento:`, {
        username: validatedUserProfile.username,
        type: validatedUserProfile.type,
        hasAccessToken: !!validatedUserProfile.accessToken,
        accessTokenLength: validatedUserProfile.accessToken?.length || 0,
        accessTokenPreview: validatedUserProfile.accessToken ? `${validatedUserProfile.accessToken.substring(0, 20)}...` : 'NO HAY'
      });
    } else {
      logProgressService.warning('No se proporcionó perfil de usuario al lanzar el juego');
    }

    // Analizar y deshabilitar mods incompatibles antes del lanzamiento
    if (i.loader && i.loader !== 'vanilla') {
      try {
        const compatibilityReport = ModCompatibilityService.getCompatibilityReport(
          i.path,
          i.loader as 'fabric' | 'forge' | 'quilt' | 'neoforge',
          i.version
        );

        if (compatibilityReport.total > 0) {
          logProgressService.warning(
            `[Mods] Se detectaron ${compatibilityReport.total} mod(s) incompatible(s): ` +
            `${compatibilityReport.critical} crítico(s), ` +
            `${compatibilityReport.problematic} problemático(s), ` +
            `${compatibilityReport.conflicts} conflicto(s)`
          );

          // Deshabilitar automáticamente mods críticos
          const result = await ModCompatibilityService.disableIncompatibleMods(
            i.path,
            i.loader as 'fabric' | 'forge' | 'quilt' | 'neoforge',
            i.version,
            {
              disableCritical: true, // Deshabilitar mods críticos automáticamente
              disableProblematic: false, // Solo advertir sobre problemáticos
              disableConflicts: false // Solo advertir sobre conflictos
            }
          );

          if (result.disabled.length > 0) {
            logProgressService.info(
              `[Mods] ${result.disabled.length} mod(s) incompatible(s) deshabilitado(s) automáticamente: ${result.disabled.join(', ')}`
            );
            logProgressService.info(
              `[Mods] Los mods deshabilitados se encuentran en: mods-disabled/`
            );
          }

          if (result.warnings.length > 0) {
            for (const warning of result.warnings) {
              logProgressService.warning(`[Mods] ${warning}`);
            }
          }
        } else {
          logProgressService.info(`[Mods] No se detectaron mods incompatibles.`);
        }
      } catch (error: any) {
        logProgressService.warning(`[Mods] Error al analizar compatibilidad de mods: ${error.message}`);
        // Continuar con el lanzamiento aunque haya error en el análisis
      }
    }

    // Registrar instancia para análisis de logs en tiempo real
    gameLogsService.registerInstance(i.id, i.path, i.loader as 'fabric' | 'forge' | 'quilt' | 'neoforge' | undefined);

    // Callback para capturar logs del juego
    const onGameData = (chunk: string) => {
      gameLogsService.addLog(i.id, chunk);
    };

    // Launch the game with all configurations using the enhanced service
    const childProcess = await gameLaunchService.launchGame({
      javaPath: finalJavaPath,
      mcVersion: i.version,
      instancePath: i.path,
      ramMb: ramMb,
      jvmArgs: jvmArgs,
      userProfile: validatedUserProfile,
      windowSize: {
        width: windowWidth,
        height: windowHeight
      },
      loader: i.loader || 'vanilla', // Pasar el tipo de loader de la instancia
      loaderVersion: instanceConfig?.loaderVersion, // Versión específica del loader si está disponible
      instanceConfig: instanceConfig as any, // Ajuste de tipo temporal
      onData: onGameData // Agregar callback para capturar logs
    });

    // Almacenar el proceso activo
    activeGameProcesses.set(i.id, childProcess);

    logProgressService.success(`Minecraft lanzado exitosamente para la instancia ${i.name}`, {
      instanceId: i.id,
      pid: childProcess.pid
    });

    // CRÍTICO: Registrar callback para limpiar el flag cuando el proceso termine
    childProcess.on('close', () => {
      logProgressService.info(`[GameLaunch] Proceso terminado para instancia ${i.name}, limpiando flag de lanzamiento activo`, {
        instanceId: i.id
      });
      activeLaunches.delete(i.id);
      activeGameProcesses.delete(i.id);
    });

    childProcess.on('error', () => {
      logProgressService.error(`[GameLaunch] Error en proceso para instancia ${i.name}, limpiando flag de lanzamiento activo`, {
        instanceId: i.id
      });
      activeLaunches.delete(i.id);
      activeGameProcesses.delete(i.id);
    });

    return { started: true, pid: childProcess.pid }
  } catch (error) {
    // CRÍTICO: Limpiar flag en caso de error
    activeLaunches.delete(i.id);
    
    logProgressService.error(`Error al lanzar la instancia ${i.name}: ${(error as Error).message}`, {
      instanceId: i.id,
      error: (error as Error).message
    });
    throw error;
  }
})

// --- IPC Handlers for Instance Creation --- //
// Handler para obtener descargas incompletas
ipcMain.handle('instance:get-incomplete-downloads', async () => {
  try {
    const incompleteDownloads = enhancedInstanceCreationService.getIncompleteDownloads();
    return incompleteDownloads;
  } catch (error) {
    console.error('Error al obtener descargas incompletas:', error);
    return [];
  }
});

// Handler para reanudar una descarga
ipcMain.handle('instance:resume-download', async (_e, downloadId: string) => {
  try {
    const { instanceDownloadPersistenceService } = require('./services/instanceDownloadPersistenceService');
    const downloadState = instanceDownloadPersistenceService.getDownload(downloadId);
    
    if (!downloadState) {
      throw new Error('Descarga no encontrada');
    }

    if (downloadState.status === 'completed') {
      throw new Error('La descarga ya está completa');
    }

    const instance = await enhancedInstanceCreationService.resumeInstanceDownload(downloadState);
    return instance;
  } catch (error) {
    console.error('Error al reanudar descarga:', error);
    throw error;
  }
});

// Handler para cancelar la creación de una instancia
ipcMain.handle('instance:cancel-creation', async (_e, instanceId: string) => {
  try {
    enhancedInstanceCreationService.cancelInstanceCreation(instanceId);
    
    // También cancelar en el servicio de persistencia
    const { instanceDownloadPersistenceService } = require('./services/instanceDownloadPersistenceService');
    instanceDownloadPersistenceService.cancel(instanceId);
    
    logProgressService.info(`[InstanceCreation] Creación de instancia cancelada: ${instanceId}`);
    return { success: true };
  } catch (error) {
    console.error('Error al cancelar creación de instancia:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handlers para importación de modpacks
ipcMain.handle('modpack-import:analyze-file', async (_e, filePath: string) => {
  try {
    return await fileAnalyzerService.analyzeFile(filePath);
  } catch (error) {
    console.error('Error al analizar archivo de modpack:', error);
    throw error;
  }
});

ipcMain.handle('modpack-import:analyze-url', async (_e, url: string) => {
  try {
    return await fileAnalyzerService.analyzeUrl(url);
  } catch (error) {
    console.error('Error al analizar URL de modpack:', error);
    throw error;
  }
});

ipcMain.handle('modpack-import:extract-and-install', async (_e, sourcePath: string, targetPath: string) => {
  try {
    return await fileAnalyzerService.extractAndInstall(sourcePath, targetPath);
  } catch (error) {
    console.error('Error al extraer e instalar modpack:', error);
    throw error;
  }
});

ipcMain.handle('modpack-import:download-and-extract-from-url', async (_e, url: string, targetPath: string) => {
  try {
    return await fileAnalyzerService.downloadAndExtractFromUrl(url, targetPath);
  } catch (error) {
    console.error('Error al descargar y extraer modpack desde URL:', error);
    throw error;
  }
});

ipcMain.handle('modpack-import:download-modpack-from-modrinth', async (_e, projectId: string, targetPath: string, mcVersion: string, loader: string) => {
  try {
    return await fileAnalyzerService.downloadModpackFromModrinth(projectId, targetPath, mcVersion, loader);
  } catch (error) {
    console.error('Error al descargar modpack de Modrinth:', error);
    throw error;
  }
});

// Handler para importar modpack y crear instancia automáticamente
ipcMain.handle('modpack-import:import-and-create-instance', async (_e, source: string, metadata: any) => {
  try {
    logProgressService.info(`[ModpackImport] Iniciando importación de modpack: ${metadata.name}`);
    
    // Paso 1: Crear la instancia base
    logProgressService.info(`[ModpackImport] Creando instancia: ${metadata.name}`);
    const instanceConfig = await enhancedInstanceCreationService.createInstance({
      name: metadata.name,
      version: metadata.mcVersion,
      loader: metadata.loader || 'vanilla',
      loaderVersion: undefined, // Se detectará automáticamente si es necesario
      javaVersion: '17',
      maxMemory: 4096,
      minMemory: 1024
    });
    
    logProgressService.info(`[ModpackImport] Instancia creada: ${instanceConfig.id}`);
    
    // Paso 2: Importar el modpack (extraer y descargar archivos)
    logProgressService.info(`[ModpackImport] Importando archivos del modpack...`);
    await fileAnalyzerService.importModpackWithDownloads(source, instanceConfig.path, metadata);
    
    logProgressService.success(`[ModpackImport] Modpack importado exitosamente: ${metadata.name}`);
    return instanceConfig;
  } catch (error) {
    logProgressService.error(`[ModpackImport] Error al importar modpack: ${error}`);
    throw error;
  }
});

// Handler para guardar un archivo temporal desde el renderer
ipcMain.handle('modpack-import:save-temporary-file', async (_e, bufferArray: number[], fileName: string) => {
  try {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    // Crear directorio temporal si no existe
    const tempDir = path.join(os.tmpdir(), 'drk_launcher_temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const extension = path.extname(fileName) || '.zip';
    const baseName = path.basename(fileName, extension);
    const tempFileName = `${baseName}_${timestamp}_${randomStr}${extension}`;
    const tempPath = path.join(tempDir, tempFileName);
    
    // Convertir el array de números a Buffer y escribir el archivo
    const nodeBuffer = Buffer.from(bufferArray);
    fs.writeFileSync(tempPath, nodeBuffer);
    
    logProgressService.info(`[ModpackImport] Archivo temporal guardado: ${tempPath} (${bufferArray.length} bytes)`);
    return tempPath;
  } catch (error) {
    console.error('Error al guardar archivo temporal:', error);
    throw error;
  }
});

// Handlers para logs del juego
ipcMain.handle('game:get-logs', async (_e, instanceId: string) => {
  try {
    return gameLogsService.getLogs(instanceId);
  } catch (error) {
    console.error('Error al obtener logs:', error);
    return [];
  }
});

ipcMain.handle('game:clear-logs', async (_e, instanceId: string) => {
  try {
    gameLogsService.clearLogs(instanceId);
    return { success: true };
  } catch (error) {
    console.error('Error al limpiar logs:', error);
    throw error;
  }
});

// Handler para cancelar un juego en ejecución
ipcMain.handle('game:kill', async (_e, instanceId: string) => {
  try {
    const process = activeGameProcesses.get(instanceId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      // Si no termina en 5 segundos, forzar terminación
      setTimeout(() => {
        if (process && !process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
      
      activeLaunches.delete(instanceId);
      activeGameProcesses.delete(instanceId);
      
      logProgressService.info(`[GameLaunch] Juego cancelado para instancia ${instanceId}`);
      return { success: true };
    }
    return { success: false, error: 'No hay proceso activo para esta instancia' };
  } catch (error) {
    logProgressService.error(`[GameLaunch] Error al cancelar juego: ${error}`);
    return { success: false, error: (error as Error).message };
  }
});

// Handler para verificar si un juego está en ejecución
ipcMain.handle('game:isRunning', async (_e) => {
  const runningIds: string[] = [];
  activeGameProcesses.forEach((process, instanceId) => {
    if (process && !process.killed) {
      runningIds.push(instanceId);
    } else {
      // Limpiar procesos muertos
      activeGameProcesses.delete(instanceId);
      activeLaunches.delete(instanceId);
    }
  });
  return runningIds;
});

ipcMain.handle('instance:create-full', async (_e, payload: { name: string; version: string; loader?: Instance['loader']; loaderVersion?: string; javaVersion?: string; maxMemory?: number; minMemory?: number; jvmArgs?: string[]; instanceId?: string }) => {
  try {
    logProgressService.info(`Iniciando creación de instancia: ${payload.name}`, {
      name: payload.name,
      version: payload.version,
      loader: payload.loader,
      loaderVersion: payload.loaderVersion || 'NO ESPECIFICADA'
    });

    // Usar el servicio mejorado de creación de instancias
    const instance = await enhancedInstanceCreationService.createInstance({
      name: payload.name,
      version: payload.version,
      loader: payload.loader || 'vanilla',
      loaderVersion: payload.loaderVersion, // IMPORTANTE: Pasar la versión del loader
      javaVersion: payload.javaVersion,
      maxMemory: payload.maxMemory,
      minMemory: payload.minMemory,
      jvmArgs: payload.jvmArgs
    }, payload.instanceId);

    logProgressService.success(`Instancia creada exitosamente: ${payload.name}`, {
      id: instance.id,
      name: payload.name,
      version: payload.version
    });

    return instance;
  } catch (error) {
    logProgressService.error(`Error creando instancia ${payload.name}: ${(error as Error).message}`, {
      name: payload.name,
      error: (error as Error).message
    });
    throw error;
  }
});

// --- IPC Handler para escanear y registrar instancias faltantes --- //
ipcMain.handle('instances:scan-and-register', async () => {
  try {
    const { instancesBaseDefault } = basePaths();

    // Verificar si existe el directorio de instancias
    if (!fs.existsSync(instancesBaseDefault)) {
      console.log('No existe el directorio de instancias:', instancesBaseDefault);
      return { count: 0, registered: [] };
    }

    // Obtener todas las carpetas en el directorio de instancias
    const allItems = fs.readdirSync(instancesBaseDefault);
    const instanceFolders = allItems.filter(item => {
      const itemPath = path.join(instancesBaseDefault, item);
      return fs.statSync(itemPath).isDirectory();
    });

    // Obtener la lista actual de instancias registradas
    const registeredInstances = listInstances();
    const registeredPaths = new Set(registeredInstances.map(instance => instance.path));

    // Encontrar carpetas que no están registradas
    const unregisteredFolders = instanceFolders.filter(folder => {
      const folderPath = path.join(instancesBaseDefault, folder);
      return !Array.from(registeredPaths).some(registeredPath => registeredPath === folderPath);
    });

    const newlyRegistered = [];
    let registeredCount = 0;

    // Intentar registrar cada carpeta no registrada
    for (const folder of unregisteredFolders) {
      const instancePath = path.join(instancesBaseDefault, folder);

      try {
        // Verificar si hay un archivo de configuración de instancia o información de versión
        // para reconstruir la información de la instancia
        const instanceJsonPath = path.join(instancePath, 'instance.json');
        let instanceConfig: InstanceConfig | null = null;

        if (fs.existsSync(instanceJsonPath)) {
          // Si existe el archivo de configuración, usarlo
          instanceConfig = JSON.parse(fs.readFileSync(instanceJsonPath, 'utf-8'));

          // Asegurarse de que tenga un ID único
          if (!instanceConfig.id) {
            instanceConfig.id = `${folder}_${Date.now()}`;
          }
        } else {
          // Si no existe, intentar reconstruir la información desde el directorio
          // Buscar información en archivos comunes de Minecraft
          const filesInDir = fs.readdirSync(instancePath);

          // Intentar encontrar alguna información básica
          let version = 'unknown';
          let loader: Instance['loader'] = 'vanilla';

          // Si hay cliente.jar, intentar encontrar información de versión
          // Buscar archivos que puedan dar indicios de la versión
          const jarFiles = filesInDir.filter(f => f.endsWith('.jar') && (f.includes('client') || f.includes('minecraft')));
          if (jarFiles.length > 0) {
            // Intentar extraer la versión del nombre del archivo
            const jarName = jarFiles[0];
            // Buscar patrones como 1.20.1 o versiones reconocibles
            const versionMatch = jarName.match(/(\d+\.\d+(?:\.\d+)?)/)?.[0];
            if (versionMatch) {
              version = versionMatch;
            }
          }

          // Revisar si hay archivos que indiquen el uso de un loader específico
          if (filesInDir.some(f => f.toLowerCase().includes('forge'))) {
            loader = 'forge';
          } else if (filesInDir.some(f => f.toLowerCase().includes('fabric'))) {
            loader = 'fabric';
          } else if (filesInDir.some(f => f.toLowerCase().includes('quilt'))) {
            loader = 'quilt';
          }

          // Crear una configuración mínima
          instanceConfig = {
            id: `${folder}_${Date.now()}`, // ID único
            name: folder,
            version: version,
            loader: loader,
            createdAt: Date.now(),
            path: instancePath
          };
        }

        // Asegurarse de que el ID sea único
        if (!instanceConfig.id) {
          instanceConfig.id = `${folder}_${Date.now()}`;
        }

        // Registrar la instancia en la lista
        const existingInList = registeredInstances.find(i => i.id === instanceConfig!.id);
        if (!existingInList) {
          const instanceForList: Instance = {
            id: instanceConfig.id,
            name: instanceConfig.name || folder,
            version: instanceConfig.version,
            loader: instanceConfig.loader || 'vanilla',
            createdAt: instanceConfig.createdAt || Date.now(),
            path: instanceConfig.path
          };

          // Guardar en la lista de instancias
          const list = listInstances();
          list.push(instanceForList);
          saveInstances(list);

          newlyRegistered.push(instanceForList);
          registeredCount++;

          console.log(`Instancia registrada automáticamente: ${folder} -> ${instanceConfig.id}`);
        }
      } catch (folderError) {
        console.error(`Error al procesar carpeta de instancia ${folder}:`, folderError);
      }
    }

    return { count: registeredCount, registered: newlyRegistered };
  } catch (error) {
    console.error('Error al escanear instancias:', error);
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
    // Detectar si es CurseForge (ID numérico) o Modrinth (ID alfanumérico)
    // Los IDs de CurseForge son siempre numéricos, los de Modrinth son alfanuméricos
    const contentIdStr = String(payload.contentId);
    const isCurseForge = /^\d+$/.test(contentIdStr);
    
    console.log(`[install-content] contentId: ${payload.contentId} (${typeof payload.contentId}), isCurseForge: ${isCurseForge}, contentType: ${payload.contentType}`);
    
    if (payload.contentType === 'modpack') {
      // Para modpacks, verificar si es CurseForge o Modrinth
      if (isCurseForge) {
        // Modpack de CurseForge
        console.log(`[install-content] Instalando modpack de CurseForge (ID: ${payload.contentId}) usando curseforgeService`);
        await curseforgeService.downloadModpack(
          payload.contentId,
          payload.instancePath,
          payload.mcVersion,
          payload.loader
        );
      } else {
        // Modpack de Modrinth
        console.log(`[install-content] Instalando modpack de Modrinth (ID: ${payload.contentId}) usando modrinthDownloadService`);
        await modrinthDownloadService.downloadModpack(
          payload.contentId,
          payload.instancePath,
          payload.mcVersion,
          payload.loader
        );
      }
    } else if (isCurseForge) {
      // Para CurseForge, usar el servicio de CurseForge
      console.log(`[install-content] Instalando contenido de CurseForge (ID: ${payload.contentId}) usando curseforgeService`);
      await curseforgeService.downloadContent(
        payload.contentId,
        payload.instancePath,
        payload.mcVersion,
        payload.loader,
        payload.contentType
      );
    } else {
      // Para Modrinth, usar el servicio de Modrinth
      console.log(`[install-content] Instalando contenido de Modrinth (ID: ${payload.contentId}) usando modrinthDownloadService`);
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

// Handler para detectar mods en una instancia
ipcMain.handle('mods:detect', async (_e, payload: { instancePath: string; loader: 'vanilla' | 'fabric' | 'forge' | 'quilt' | 'neoforge' }) => {
  try {
    const mods = ModDetectionService.detectInstalledMods(payload.instancePath, payload.loader);
    return { success: true, mods };
  } catch (error: any) {
    console.error('Error al detectar mods:', error);
    return { success: false, error: error.message, mods: [] };
  }
});

// Handler para obtener estadísticas de mods
ipcMain.handle('mods:get-stats', async (_e, payload: { instancePath: string; loader: 'vanilla' | 'fabric' | 'forge' | 'quilt' | 'neoforge' }) => {
  try {
    const stats = ModDetectionService.getModStats(payload.instancePath, payload.loader);
    return { success: true, stats };
  } catch (error: any) {
    console.error('Error al obtener estadísticas de mods:', error);
    return { success: false, error: error.message, stats: null };
  }
});

// Handler para detectar mods de optimización faltantes
ipcMain.handle('mods:detect-missing-optimization', async (_e, payload: { instancePath: string; loader: 'vanilla' | 'fabric' | 'forge' | 'quilt' | 'neoforge'; mcVersion: string }) => {
  try {
    const missingMods = ModDetectionService.detectMissingOptimizationMods(
      payload.instancePath,
      payload.loader,
      payload.mcVersion
    );
    return { success: true, missingMods };
  } catch (error: any) {
    console.error('Error al detectar mods de optimización faltantes:', error);
    return { success: false, error: error.message, missingMods: [] };
  }
});

// Handler para diagnosticar problemas con mods
ipcMain.handle('mods:diagnose', async (_e, payload: { instancePath: string; loader: 'vanilla' | 'fabric' | 'forge' | 'quilt' | 'neoforge'; mcVersion: string }) => {
  try {
    const diagnosis = await ModDiagnosticService.diagnoseMods(
      payload.instancePath,
      payload.loader,
      payload.mcVersion
    );
    return { success: true, diagnosis };
  } catch (error: any) {
    console.error('Error al diagnosticar mods:', error);
    return { success: false, error: error.message, diagnosis: null };
  }
});

// Handler para listar archivos en la carpeta mods
ipcMain.handle('mods:list-files', async (_e, instancePath: string) => {
  try {
    const files = ModDiagnosticService.listModsFiles(instancePath);
    return { success: true, files };
  } catch (error: any) {
    console.error('Error al listar archivos de mods:', error);
    return { success: false, error: error.message, files: [] };
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

ipcMain.handle('java:getJavaForMinecraftVersion', async (_event, minecraftVersion: string) => {
  try {
    return await javaService.getJavaForMinecraftVersion(minecraftVersion);
  } catch (error) {
    console.error('Error getting Java for Minecraft version:', error);
    throw error;
  }
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
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';

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
      fileStream.on('finish', () => resolve(undefined));
      fileStream.on('error', reject);
      progressStream.on('error', reject);
    });

    // Enviar evento de descarga completada
    win.webContents.send('download:complete', {
      itemId,
      filePath
    });
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
    // Fetch multiple pages concurrently to get more results (up to 2000 total) since Modrinth API has a max of 100 per request
    const PAGE_SIZE = 100; // Modrinth API maximum per request
    const maxResults = 2000; // Maximum results to fetch (20 requests × 100)

    // Calculate how many requests we'll need
    const numRequests = Math.min(20, Math.ceil(maxResults / PAGE_SIZE)); // Maximum of 20 requests for 2000 results

    // Create all request promises
    const requests = [];
    for (let i = 0; i < numRequests; i++) {
      const offset = i * PAGE_SIZE;
      const searchParams = new URLSearchParams({
        query: search || '', // Puede ser vacío para obtener resultados generales
        facets: JSON.stringify(facets),
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
        index: search ? 'relevance' : 'downloads' // Ordenar por descargas si no hay búsqueda específica
      });

      const url = `${MODRINTH_API_URL}/search?${searchParams}`;
      console.log(`Preparando solicitud Modrinth ${i + 1}:`, url);

      requests.push(
        fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'DRKLauncher/1.0 (haroldpgr@gmail.com)',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
          }
        })
      );
    }

    // Execute all requests concurrently
    const responses = await Promise.all(requests);

    // Process all responses
    const allResults: any[] = [];
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Error al buscar en Modrinth (solicitud ${i + 1}): ${response.status} ${response.statusText}`, errorBody);
        continue; // Continue with other responses
      }

      const json = await response.json();
      console.log(`Respuesta de Modrinth solicitud ${i + 1}:`, json); // Debug log

      // Verificar si hay resultados válidos
      if (json && json.hits && Array.isArray(json.hits)) {
        allResults.push(...json.hits);
      } else {
        console.warn(`La respuesta ${i + 1} de Modrinth no contiene resultados válidos:`, json);
      }

      // Break if we get fewer results than expected (last page)
      if (json.hits && json.hits.length < PAGE_SIZE) {
        break;
      }
    }

    // Limit to maxResults if needed
    const finalResults = allResults.slice(0, maxResults);

    // Mapear la respuesta de Modrinth a nuestro formato
    return finalResults.map((item: any) => ({
      id: item.project_id || item.id,
      title: item.title,
      description: item.description,
      author: item.author || 'Desconocido',
      downloads: item.downloads || 0,
      lastUpdated: item.date_modified || item.updated,
      minecraftVersions: item.versions || [],
      categories: item.categories || [],
      imageUrl: item.icon_url || item.url || item.logo_url || 'https://via.placeholder.com/400x200',
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

// --- CurseForge API Integration --- //
const CURSEFORGE_API_URL = 'https://api.curseforge.com/v1';

// Manejador IPC para búsquedas de CurseForge
ipcMain.handle('curseforge:search', async (_event, { contentType, search }) => {
  return curseforgeService.searchContent(contentType, search);
});

// Manejador para obtener versiones compatibles de CurseForge
ipcMain.handle('curseforge:get-compatible-versions', async (_event, payload: {
  projectId: string,
  mcVersion: string,
  loader?: string
}) => {
  return await curseforgeService.getCompatibleVersions(
    payload.projectId,
    payload.mcVersion,
    payload.loader
  );
});

// --- Ely.by API Integration --- //
const ELY_BY_AUTH_BASE = 'https://authserver.ely.by';
// Endpoint de autorización - según documentación oficial es /oauth2/v1 (sin /authorize)
const ELY_BY_OAUTH_AUTHORIZE_ENDPOINT = 'https://account.ely.by/oauth2/v1';
// Endpoint de token según documentación: /api/oauth2/v1/token (con /api/)
const ELY_BY_OAUTH_TOKEN_ENDPOINT = 'https://account.ely.by/api/oauth2/v1/token';
const ELY_BY_OAUTH_USER_ENDPOINT = 'https://account.ely.by/api/oauth2/v1/user';

// Configuración OAuth 2.0 de Ely.by con PKCE
// Client ID: drk-launcher (cliente público, requiere PKCE)
const ELY_BY_OAUTH_CONFIG = {
  clientId: 'drk-launcher',
  redirectUri: 'http://127.0.0.1:25565/callback',
  // Scope según el prompt mejorado: minecraft_server_session
  scope: 'minecraft_server_session'
};

// --- LittleSkin OAuth 2.0 Integration --- //
// Documentación: https://manual.littlesk.in/advanced/oauth2/
const LITTLESKIN_OAUTH_AUTHORIZE_ENDPOINT = 'https://littleskin.cn/oauth/authorize';
const LITTLESKIN_OAUTH_TOKEN_ENDPOINT = 'https://littleskin.cn/oauth/token';
const LITTLESKIN_OAUTH_USER_ENDPOINT = 'https://littleskin.cn/api/user';

// Configuración OAuth 2.0 de LittleSkin
// Credenciales obtenidas de: https://littleskin.cn/user/oauth/manage
const LITTLESKIN_OAUTH_CONFIG = {
  clientId: '1266',
  clientSecret: 'Z18Fr0LDceUSkF2dQo2JPle5VWCQ83G26UpJUoFB',
  redirectUri: 'http://127.0.0.1:4567/auth/callback', // Debe coincidir con el configurado en LittleSkin
  // Scopes disponibles según documentación de LittleSkin
  // Probar primero sin scope o con scopes básicos
  // Según la documentación, los scopes pueden variar
  scope: '' // Dejar vacío primero para ver qué scopes acepta
};

// Generar un clientToken único para esta sesión
const generateClientToken = (): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
};

// ===== Funciones PKCE para OAuth 2.0 =====

/**
 * Genera un code_verifier aleatorio para PKCE
 * Debe ser una cadena URL-safe de 43-128 caracteres
 * RFC 7636: mínimo 43 caracteres, máximo 128 caracteres
 */
function generateCodeVerifier(): string {
  const crypto = require('crypto');
  // Generar 32 bytes aleatorios (256 bits) para obtener ~43 caracteres después de base64url
  const randomBytes = crypto.randomBytes(32);
  const verifier = base64UrlEncode(randomBytes);
  
  // Verificar que tenga al menos 43 caracteres (requisito PKCE)
  if (verifier.length < 43) {
    // Si es muy corto, generar más bytes
    const moreBytes = crypto.randomBytes(16);
    return verifier + base64UrlEncode(moreBytes);
  }
  
  return verifier;
}

/**
 * Genera un code_challenge a partir de un code_verifier usando S256 (SHA256 + Base64url)
 */
function generateCodeChallenge(codeVerifier: string): string {
  const crypto = require('crypto');
  // Calcular SHA256 del code_verifier
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  // Codificar en base64url
  return base64UrlEncode(hash);
}

/**
 * Codifica un Buffer en Base64url (sin padding, con caracteres URL-safe)
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Crea un servidor HTTP local para escuchar el callback de OAuth
 * @param port Puerto en el que escuchar (default: 25565)
 * @param path Ruta del callback (default: '/callback')
 */
function createCallbackServer(port: number = 25565, path: string = '/callback'): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      
      // Verificar que es la ruta de callback
      if (url.pathname === path) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // Enviar respuesta HTML al usuario
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Error de Autenticación</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: #fff; }
                .error { color: #ff4444; }
              </style>
            </head>
            <body>
              <h1 class="error">Error de Autenticación</h1>
              <p>${errorDescription || error}</p>
              <p>Puedes cerrar esta ventana.</p>
            </body>
            </html>
          `);
          server.close();
          reject(new Error(errorDescription || error));
          return;
        }

        if (code && state) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Autenticación Exitosa</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: #fff; }
                .success { color: #44ff44; }
              </style>
            </head>
            <body>
              <h1 class="success">✓ Autenticación Exitosa</h1>
              <p>Puedes cerrar esta ventana y volver al launcher.</p>
            </body>
            </html>
          `);
          
          // Cerrar el servidor después de un breve delay
          setTimeout(() => {
            server.close();
          }, 1000);
          
          resolve({ code, state });
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Error</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: #fff; }
                .error { color: #ff4444; }
              </style>
            </head>
            <body>
              <h1 class="error">Error</h1>
              <p>No se recibió el código de autorización.</p>
              <p>Puedes cerrar esta ventana.</p>
            </body>
            </html>
          `);
          server.close();
          reject(new Error('No se recibió el código de autorización'));
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Escuchar en el puerto especificado
    server.listen(port, '127.0.0.1', () => {
      console.log(`[OAuth] Servidor de callback escuchando en http://127.0.0.1:${port}${path}`);
    });

    // Timeout de 5 minutos
    setTimeout(() => {
      if (server.listening) {
        server.close();
        reject(new Error('Timeout: No se recibió respuesta del servidor de autorización'));
      }
    }, 5 * 60 * 1000);
  });
}

// Manejador IPC para verificar usuarios de Ely.by (evita CORS)
ipcMain.handle('elyby:verify-username', async (_event, username: string) => {
  try {
    const response = await fetch(`${ELY_BY_AUTH_BASE}/api/users/profiles/minecraft/${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 204) {
      // Usuario no encontrado
      return { exists: false, user: null };
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { exists: true, user: data };
  } catch (error) {
    console.error('Error al buscar usuario en Ely.by:', error);
    throw error;
  }
});

/**
 * Función principal para autenticar con Ely.by usando OAuth 2.0 con PKCE
 * Implementación completa según el prompt mejorado
 */
async function authenticateElyBy(): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  selectedProfile?: { id: string; name: string };
  user?: any;
  error?: string;
}> {
  console.log('[Ely.by OAuth PKCE] Iniciando flujo OAuth 2.0 con PKCE...');
  
  // Paso 1: Generación PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateClientToken(); // State para seguridad CSRF
  
  console.log('[Ely.by OAuth PKCE] Code verifier generado:', codeVerifier.substring(0, 20) + '...');
  console.log('[Ely.by OAuth PKCE] Code challenge generado:', codeChallenge.substring(0, 20) + '...');
  console.log('[Ely.by OAuth PKCE] State generado:', state);
  
  // Validar que todos los valores PKCE estén presentes
  if (!codeVerifier || !codeChallenge || !state) {
    throw new Error('Error al generar claves PKCE. Valores nulos detectados.');
  }
  
  // Paso 2: Iniciar Servidor Local
  const callbackPromise = createCallbackServer();
  console.log('[Ely.by OAuth PKCE] Servidor local iniciado, esperando callback...');
  
  // Paso 3: Construir URL de autorización con todos los parámetros PKCE
  // ENDPOINT: https://account.ely.by/oauth2/v1
  if (!ELY_BY_OAUTH_CONFIG.clientId || !ELY_BY_OAUTH_CONFIG.redirectUri) {
    throw new Error('Configuración OAuth incompleta. Faltan clientId o redirectUri.');
  }
  
  const scope = ELY_BY_OAUTH_CONFIG.scope?.trim() || 'minecraft_server_session';
  
  const authUrl = new URL(ELY_BY_OAUTH_AUTHORIZE_ENDPOINT);
  authUrl.searchParams.set('client_id', ELY_BY_OAUTH_CONFIG.clientId);
  authUrl.searchParams.set('redirect_uri', ELY_BY_OAUTH_CONFIG.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  
  console.log(`[Ely.by OAuth PKCE] URL de autorización completa: ${authUrl.toString()}`);
  console.log(`[Ely.by OAuth PKCE] Parámetros de autorización:`, {
    client_id: ELY_BY_OAUTH_CONFIG.clientId,
    redirect_uri: ELY_BY_OAUTH_CONFIG.redirectUri,
    response_type: 'code',
    scope: scope,
    code_challenge: codeChallenge.substring(0, 20) + '...',
    code_challenge_method: 'S256',
    state: state,
    code_challenge_length: codeChallenge.length,
    code_verifier_length: codeVerifier.length
  });
  
  // Abrir URL en el navegador del usuario usando Electron shell.openExternal
  await shell.openExternal(authUrl.toString());
  console.log('[Ely.by OAuth PKCE] Navegador abierto para autorización');
  
  // Paso 4: Interceptar Callback
  console.log('[Ely.by OAuth PKCE] Esperando callback en http://127.0.0.1:25565/callback...');
  const { code, state: receivedState } = await callbackPromise;
  
  // Verificar el state (protección CSRF)
  if (receivedState !== state) {
    throw new Error('El state no coincide. Posible ataque CSRF.');
  }
  
  console.log('[Ely.by OAuth PKCE] Código de autorización recibido:', code.substring(0, 20) + '...');
  
  // Paso 5: Intercambio de Token (POST)
  // ENDPOINT: https://account.ely.by/api/oauth2/v1/token
  if (!code || !codeVerifier) {
    throw new Error('Código de autorización o code_verifier faltante');
  }
  
  const tokenParams = new URLSearchParams();
  tokenParams.append('grant_type', 'authorization_code');
  tokenParams.append('client_id', ELY_BY_OAUTH_CONFIG.clientId);
  tokenParams.append('code', code);
  tokenParams.append('redirect_uri', ELY_BY_OAUTH_CONFIG.redirectUri);
  tokenParams.append('code_verifier', codeVerifier); // Enviar el code_verifier original
  
  console.log('[Ely.by OAuth PKCE] Intercambiando código por token...');
  console.log('[Ely.by OAuth PKCE] Endpoint:', ELY_BY_OAUTH_TOKEN_ENDPOINT);
  console.log('[Ely.by OAuth PKCE] Parámetros del token:', {
    grant_type: 'authorization_code',
    client_id: ELY_BY_OAUTH_CONFIG.clientId,
    code: code.substring(0, 20) + '...',
    redirect_uri: ELY_BY_OAUTH_CONFIG.redirectUri,
    code_verifier_length: codeVerifier.length
  });
  
  const tokenResponse = await fetch(ELY_BY_OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString()
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[Ely.by OAuth PKCE] Error al intercambiar código:', errorText);
    throw new Error(`Error al obtener token (${tokenResponse.status}): ${errorText}`);
  }
  
  const tokenData = await tokenResponse.json();
  console.log('[Ely.by OAuth PKCE] Token recibido exitosamente');
  
  if (!tokenData.access_token) {
    throw new Error('No se recibió access_token en la respuesta');
  }
  
  // Paso 6: Uso del Token - Obtener información del usuario
  // ENDPOINT: https://account.ely.by/api/oauth2/v1/user
  console.log('[Ely.by OAuth PKCE] Obteniendo información del usuario...');
  const userResponse = await fetch(ELY_BY_OAUTH_USER_ENDPOINT, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    }
  });
  
  let userInfo: any = null;
  if (userResponse.ok) {
    userInfo = await userResponse.json();
    console.log('[Ely.by OAuth PKCE] Información del usuario obtenida:', userInfo);
  } else {
    console.warn('[Ely.by OAuth PKCE] No se pudo obtener información del usuario, pero el token es válido');
  }
  
  // Retornar resultado exitoso
  return {
    success: true,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    tokenType: tokenData.token_type || 'Bearer',
    selectedProfile: {
      id: userInfo?.uuid || userInfo?.id || '',
      name: userInfo?.username || userInfo?.name || 'Ely.by User'
    },
    user: userInfo
  };
}

// Manejador IPC para iniciar el flujo OAuth 2.0 de Ely.by con PKCE
ipcMain.handle('elyby:start-oauth', async (_event) => {
  try {
    return await authenticateElyBy();
  } catch (error: any) {
    console.error('[Ely.by OAuth PKCE] Error en el flujo OAuth:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido en el flujo OAuth'
    };
  }
});

/**
 * Función principal para autenticar con LittleSkin usando OAuth 2.0
 * Documentación: https://manual.littlesk.in/advanced/oauth2/
 * Usa Authorization Code Grant (flujo estándar de OAuth 2.0)
 */
async function authenticateLittleSkin(): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  selectedProfile?: { id: string; name: string };
  user?: any;
  error?: string;
}> {
  console.log('[LittleSkin OAuth] Iniciando flujo OAuth 2.0...');
  
  // Validar configuración
  if (!LITTLESKIN_OAUTH_CONFIG.clientId || !LITTLESKIN_OAUTH_CONFIG.clientSecret) {
    throw new Error('Configuración de LittleSkin incompleta. Necesitas registrar una aplicación en https://littleskin.cn/user/oauth/apps');
  }
  
  // Paso 1: Generar state para seguridad CSRF
  const state = generateClientToken();
  console.log('[LittleSkin OAuth] State generado:', state);
  
  // Paso 2: Iniciar Servidor Local
  // LittleSkin usa puerto 4567 y ruta /auth/callback según la configuración
  const callbackUrl = new URL(LITTLESKIN_OAUTH_CONFIG.redirectUri);
  const callbackPort = parseInt(callbackUrl.port) || 4567;
  const callbackPath = callbackUrl.pathname || '/auth/callback';
  
  const callbackPromise = createCallbackServer(callbackPort, callbackPath);
  console.log(`[LittleSkin OAuth] Servidor local iniciado, esperando callback en ${LITTLESKIN_OAUTH_CONFIG.redirectUri}...`);
  
  // Paso 3: Construir URL de autorización
  // ENDPOINT: https://littleskin.cn/oauth/authorize
  const scope = LITTLESKIN_OAUTH_CONFIG.scope?.trim() || '';
  
  const authUrl = new URL(LITTLESKIN_OAUTH_AUTHORIZE_ENDPOINT);
  authUrl.searchParams.set('client_id', LITTLESKIN_OAUTH_CONFIG.clientId);
  authUrl.searchParams.set('redirect_uri', LITTLESKIN_OAUTH_CONFIG.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  // Solo agregar scope si no está vacío (algunos servicios OAuth no requieren scope)
  if (scope) {
    authUrl.searchParams.set('scope', scope);
  }
  authUrl.searchParams.set('state', state);
  
  console.log(`[LittleSkin OAuth] URL de autorización: ${authUrl.toString()}`);
  console.log(`[LittleSkin OAuth] Parámetros de autorización:`, {
    client_id: LITTLESKIN_OAUTH_CONFIG.clientId,
    redirect_uri: LITTLESKIN_OAUTH_CONFIG.redirectUri,
    response_type: 'code',
    scope: scope || '(sin scope)',
    state: state,
    scope_incluido_en_url: scope ? 'Sí' : 'No'
  });
  
  // Abrir URL en el navegador del usuario
  await shell.openExternal(authUrl.toString());
  console.log('[LittleSkin OAuth] Navegador abierto para autorización');
  
  // Paso 4: Interceptar Callback
  console.log(`[LittleSkin OAuth] Esperando callback en ${LITTLESKIN_OAUTH_CONFIG.redirectUri}...`);
  const { code, state: receivedState } = await callbackPromise;
  
  // Verificar el state (protección CSRF)
  if (receivedState !== state) {
    throw new Error('El state no coincide. Posible ataque CSRF.');
  }
  
  console.log('[LittleSkin OAuth] Código de autorización recibido:', code.substring(0, 20) + '...');
  
  // Paso 5: Intercambio de Token (POST)
  // ENDPOINT: https://littleskin.cn/oauth/token
  // LittleSkin usa client_id y client_secret (no PKCE)
  const tokenParams = new URLSearchParams();
  tokenParams.append('grant_type', 'authorization_code');
  tokenParams.append('client_id', LITTLESKIN_OAUTH_CONFIG.clientId);
  tokenParams.append('client_secret', LITTLESKIN_OAUTH_CONFIG.clientSecret);
  tokenParams.append('code', code);
  tokenParams.append('redirect_uri', LITTLESKIN_OAUTH_CONFIG.redirectUri);
  
  console.log('[LittleSkin OAuth] Intercambiando código por token...');
  console.log('[LittleSkin OAuth] Endpoint:', LITTLESKIN_OAUTH_TOKEN_ENDPOINT);
  
  const tokenResponse = await fetch(LITTLESKIN_OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenParams.toString()
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[LittleSkin OAuth] Error al intercambiar código:', errorText);
    throw new Error(`Error al obtener token (${tokenResponse.status}): ${errorText}`);
  }
  
  const tokenData = await tokenResponse.json();
  console.log('[LittleSkin OAuth] Token recibido exitosamente');
  
  if (!tokenData.access_token) {
    throw new Error('No se recibió access_token en la respuesta');
  }
  
  // Paso 6: Uso del Token - Obtener información del usuario
  // ENDPOINT: https://littleskin.cn/api/user
  console.log('[LittleSkin OAuth] Obteniendo información del usuario...');
  const userResponse = await fetch(LITTLESKIN_OAUTH_USER_ENDPOINT, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json'
    }
  });
  
  let userInfo: any = null;
  if (userResponse.ok) {
    userInfo = await userResponse.json();
    console.log('[LittleSkin OAuth] Información del usuario obtenida:', userInfo);
  } else {
    console.warn('[LittleSkin OAuth] No se pudo obtener información del usuario, pero el token es válido');
  }
  
  // Retornar resultado exitoso
  return {
    success: true,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    tokenType: tokenData.token_type || 'Bearer',
    selectedProfile: {
      id: userInfo?.uid || userInfo?.id || '',
      name: userInfo?.nickname || userInfo?.username || 'LittleSkin User'
    },
    user: userInfo
  };
}

// Manejador IPC para iniciar el flujo OAuth 2.0 de LittleSkin
ipcMain.handle('littleskin:start-oauth', async (_event) => {
  try {
    return await authenticateLittleSkin();
  } catch (error: any) {
    console.error('[LittleSkin OAuth] Error en el flujo OAuth:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido en el flujo OAuth'
    };
  }
});

// Las funciones handleOAuthCallback, exchangeCodeForToken y getUserInfo antiguas
// ya no son necesarias porque el nuevo flujo PKCE las maneja directamente en el handler IPC

// Manejador IPC para autenticar usuarios de Ely.by con username/email y contraseña (método alternativo)
// Documentación: https://docs.ely.by/en/minecraft-auth.html
// Endpoint correcto: POST /auth/authenticate
ipcMain.handle('elyby:authenticate', async (_event, username: string, password: string, totpToken?: string) => {
  try {
    const clientToken = generateClientToken();
    
    // Si se proporciona un token TOTP, concatenarlo con la contraseña
    const finalPassword = totpToken ? `${password}:${totpToken}` : password;
    
    const url = `${ELY_BY_AUTH_BASE}/auth/authenticate`;
    console.log(`[Ely.by] Intentando autenticación en: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent: {
          name: 'Minecraft',
          version: 1
        },
        username: username,
        password: finalPassword,
        clientToken: clientToken,
        requestUser: true  // Para obtener información adicional del usuario
      }),
    });
    
    console.log(`[Ely.by] Respuesta: status=${response.status}, statusText=${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: 'UnknownError', errorMessage: errorText || `HTTP error! status: ${response.status}` };
      }
      
      // Verificar si es un error de autenticación de dos factores
      if (response.status === 401 && errorData.error === 'ForbiddenOperationException' && 
          errorData.errorMessage === 'Account protected with two factor auth.') {
        // La cuenta requiere autenticación de dos factores
        return {
          success: false,
          requires2FA: true,
          error: 'Esta cuenta está protegida con autenticación de dos factores. Por favor, ingresa el código de verificación.',
          clientToken: clientToken  // Mantener el clientToken para el siguiente intento
        };
      }
      
      // Otro tipo de error
      throw new Error(errorData.errorMessage || errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.selectedProfile) {
      console.log(`[Ely.by] ✓ Autenticación exitosa para usuario: ${data.selectedProfile.name}`);
      return {
        success: true,
        accessToken: data.accessToken,
        clientToken: data.clientToken || clientToken,
        selectedProfile: {
          id: data.selectedProfile.id,
          name: data.selectedProfile.name
        },
        availableProfiles: data.availableProfiles || [],
        user: data.user || null
      };
    } else {
      throw new Error('No se recibió información del perfil');
    }
  } catch (error: any) {
    console.error('Error al autenticar usuario en Ely.by:', error);
    return {
      success: false,
      requires2FA: false,
      error: error.message || 'Error desconocido al autenticar'
    };
  }
});

// --- Yggdrasil Authentication Integration --- //
// Configuración del servidor Yggdrasil (puede ser cambiada según necesidad)
const YGGDRASIL_BASE_URL = process.env.YGGDRASIL_BASE_URL || 'http://localhost:8080/authserver';

// Crear instancia del cliente Yggdrasil
const yggdrasilClientInstance = new YggdrasilClient(YGGDRASIL_BASE_URL);

// --- Drk Launcher Authentication Integration --- //
// Configuración del servidor de autenticación Drk Launcher
// Para desarrollo local, usar: http://localhost:3000/authserver
// Para producción, usar: https://api.drklauncher.com/authserver
const DRK_AUTH_BASE_URL = process.env.DRK_AUTH_BASE_URL || 'http://localhost:3000/authserver';

// Crear instancia del cliente Drk Auth
const drkAuthClientInstance = new DrkAuthClient(DRK_AUTH_BASE_URL);

// IPC Handler para autenticar con Yggdrasil
ipcMain.handle('yggdrasil:authenticate', async (_event, username: string, password: string) => {
  try {
    console.log(`[Yggdrasil IPC] Autenticando usuario: ${username}`);
    const result = await yggdrasilClientInstance.authenticate(username, password);
    return {
      success: true,
      accessToken: result.accessToken,
      clientToken: result.clientToken,
      selectedProfile: result.selectedProfile,
      availableProfiles: result.availableProfiles || [],
      user: result.user
    };
  } catch (error: any) {
    console.error('[Yggdrasil IPC] Error en authenticate:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al autenticar'
    };
  }
});

// IPC Handler para refrescar tokens Yggdrasil
ipcMain.handle('yggdrasil:refresh', async (_event, accessToken: string, clientToken: string) => {
  try {
    console.log(`[Yggdrasil IPC] Refrescando tokens...`);
    const result = await yggdrasilClientInstance.refresh(accessToken, clientToken);
    return {
      success: true,
      accessToken: result.accessToken,
      clientToken: result.clientToken,
      selectedProfile: result.selectedProfile,
      user: result.user
    };
  } catch (error: any) {
    console.error('[Yggdrasil IPC] Error en refresh:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al refrescar tokens'
    };
  }
});

// IPC Handler para validar token Yggdrasil
ipcMain.handle('yggdrasil:validate', async (_event, accessToken: string) => {
  try {
    console.log(`[Yggdrasil IPC] Validando token...`);
    const isValid = await yggdrasilClientInstance.validate(accessToken);
    return {
      success: true,
      isValid: isValid
    };
  } catch (error: any) {
    console.error('[Yggdrasil IPC] Error en validate:', error);
    return {
      success: false,
      isValid: false,
      error: error.message || 'Error desconocido al validar token'
    };
  }
});

// --- Drk Launcher Auth IPC Handlers --- //

// IPC Handler para autenticar con Drk Launcher
ipcMain.handle('drkauth:authenticate', async (_event, username: string, password: string) => {
  try {
    console.log(`[DrkAuth IPC] Autenticando usuario: ${username}`);
    const result = await drkAuthClientInstance.authenticate(username, password);
    return {
      success: true,
      accessToken: result.accessToken,
      clientToken: result.clientToken,
      selectedProfile: result.selectedProfile,
      availableProfiles: result.availableProfiles || [],
      user: result.user
    };
  } catch (error: any) {
    console.error('[DrkAuth IPC] Error en authenticate:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al autenticar'
    };
  }
});

// IPC Handler para refrescar tokens Drk Launcher
ipcMain.handle('drkauth:refresh', async (_event, accessToken: string, clientToken: string) => {
  try {
    console.log(`[DrkAuth IPC] Refrescando tokens...`);
    const result = await drkAuthClientInstance.refresh(accessToken, clientToken);
    return {
      success: true,
      accessToken: result.accessToken,
      clientToken: result.clientToken,
      selectedProfile: result.selectedProfile,
      user: result.user
    };
  } catch (error: any) {
    console.error('[DrkAuth IPC] Error en refresh:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al refrescar tokens'
    };
  }
});

// IPC Handler para validar token Drk Launcher
ipcMain.handle('drkauth:validate', async (_event, accessToken: string) => {
  try {
    console.log(`[DrkAuth IPC] Validando token...`);
    const isValid = await drkAuthClientInstance.validate(accessToken);
    return {
      success: true,
      isValid: isValid
    };
  } catch (error: any) {
    console.error('[DrkAuth IPC] Error en validate:', error);
    return {
      success: false,
      isValid: false,
      error: error.message || 'Error desconocido al validar token'
    };
  }
});

// --- Microsoft Auth IPC Handlers --- //

// IPC Handler para autenticar con Microsoft
ipcMain.handle('microsoft:authenticate', async (_event) => {
  try {
    console.log(`[Microsoft Auth IPC] Iniciando autenticación...`);
    const result = await microsoftAuthClient.authenticate();
    return {
      success: true,
      accessToken: result.accessToken,
      clientToken: result.accessToken, // Usar accessToken como clientToken para Microsoft
      selectedProfile: result.selectedProfile,
      user: result.user
    };
  } catch (error: any) {
    console.error('[Microsoft Auth IPC] Error en authenticate:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al autenticar con Microsoft'
    };
  }
});

// IPC Handler para refrescar tokens Microsoft
ipcMain.handle('microsoft:refresh', async (_event, accessToken: string, clientToken: string) => {
  try {
    console.log(`[Microsoft Auth IPC] Refrescando tokens...`);
    // Nota: Microsoft usa refresh tokens, pero por ahora retornamos error
    // ya que necesitaríamos almacenar el refresh token
    return {
      success: false,
      error: 'Refresh de tokens no implementado aún. Por favor, inicia sesión de nuevo.'
    };
  } catch (error: any) {
    console.error('[Microsoft Auth IPC] Error en refresh:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al refrescar tokens'
    };
  }
});

// IPC Handler para validar token Microsoft
ipcMain.handle('microsoft:validate', async (_event, accessToken: string) => {
  try {
    console.log(`[Microsoft Auth IPC] Validando token...`);
    // Validar token consultando el perfil de Minecraft
    const response = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const isValid = response.ok;
    return {
      success: true,
      isValid: isValid
    };
  } catch (error: any) {
    console.error('[Microsoft Auth IPC] Error en validate:', error);
    return {
      success: false,
      isValid: false,
      error: error.message || 'Error desconocido al validar token'
    };
  }
});

// IPC Handlers para cancelación de descargas
ipcMain.handle('download:cancel', async (_event, downloadId: string) => {
  const { downloadQueueService } = await import('../services/downloadQueueService.js');
  return downloadQueueService.cancelDownloadById(downloadId);
});

ipcMain.handle('download:cancelAll', async (_event) => {
  const { downloadQueueService } = await import('../services/downloadQueueService.js');
  return downloadQueueService.cancelAllDownloads();
});

// IPC Handlers para el sistema de logs y progreso
ipcMain.handle('logs:get-recent', async (_event, count: number = 50) => {
  return logProgressService.getRecentLogs(count);
});

ipcMain.handle('logs:get-by-type', async (_event, { type, count }: { type: string; count: number }) => {
  return logProgressService.getLogsByType(type as any, count);
});

ipcMain.handle('logs:get-stats', async () => {
  return logProgressService.getStats();
});

ipcMain.handle('progress:get-all-statuses', async () => {
  return logProgressService.getAllProgressStatuses();
});

ipcMain.handle('progress:get-overall', async () => {
  return logProgressService.getOverallProgress();
});

ipcMain.handle('progress:get-download-statuses', async () => {
  return logProgressService.getCurrentDownloadStatuses();
});

app.on('window-all-closed', () => {
  // Limpiar atajos de teclado al cerrar la aplicación
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit()
})

// CRÍTICO: Permitir que la aplicación se cierre cuando hay una actualización pendiente
// NO prevenir el cierre durante las actualizaciones - esto es esencial para que quitAndInstall funcione
app.on('before-quit', (event) => {
  // NO prevenir el cierre - electron-updater necesita que la app se cierre para instalar
  // Si hay una actualización descargada, quitAndInstall ya fue llamado y necesita que la app se cierre
  console.log('[Main] before-quit: Permitiendo cierre (necesario para actualizaciones)');
  // NO llamar event.preventDefault() - la app debe poder cerrarse libremente
})
