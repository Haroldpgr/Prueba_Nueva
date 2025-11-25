var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main/main.ts
var import_electron2 = require("electron");
var import_node_path3 = __toESM(require("node:path"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);

// src/services/db.ts
var import_node_path = __toESM(require("node:path"), 1);
var import_electron = require("electron");
var db = { ready: false, instance: null };
function initDB() {
  try {
    const Database = require("better-sqlite3");
    const file = import_node_path.default.join(import_electron.app.getPath("userData"), "drk.sqlite");
    db.instance = new Database(file);
    db.instance.pragma("journal_mode = WAL");
    db.instance.exec(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT,
        version TEXT,
        loader TEXT,
        createdAt INTEGER,
        path TEXT,
        ramMb INTEGER,
        userProfile TEXT
      );
      CREATE TABLE IF NOT EXISTS crashes (
        id TEXT PRIMARY KEY,
        instanceId TEXT,
        createdAt INTEGER,
        summary TEXT,
        logPath TEXT,
        recommendation TEXT
      );
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT,
        ip TEXT,
        country TEXT,
        category TEXT,
        thumbnail TEXT,
        requiredVersion TEXT,
        modsHint TEXT,
        favorite INTEGER
      );
    `);
    db.ready = true;
  } catch (e) {
    db.ready = false;
  }
}
function hasDB() {
  return db.ready;
}
function sqlite() {
  return db.instance;
}

// src/services/http.ts
async function fetchWithRetry(url, init, retries = 2, backoffMs = 500) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastErr;
}
var lastTs = 0;
var tokens = 5;
var capacity = 5;
var refillMs = 1e3;
async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastTs;
  lastTs = now;
  tokens = Math.min(capacity, tokens + elapsed / refillMs);
  if (tokens < 1) await new Promise((r) => setTimeout(r, refillMs));
  tokens -= 1;
}

// src/services/serverService.ts
async function queryStatus(ip) {
  await rateLimit();
  try {
    const res = await fetchWithRetry(`https://api.mcsrvstat.us/2/${encodeURIComponent(ip)}`);
    const json = await res.json();
    return { online: !!json.online, players: json.players?.online ?? 0, version: json.version ?? "" };
  } catch {
    return { online: false, players: 0, version: "" };
  }
}

// src/services/gameService.ts
var import_node_child_process = require("node:child_process");
var import_node_path2 = __toESM(require("node:path"), 1);
function buildArgs(opts) {
  const mem = Math.max(512, opts.ramMb || 2048);
  const args = [
    `-Xms${mem}m`,
    `-Xmx${mem}m`,
    ...opts.jvmArgs || [],
    "-jar",
    import_node_path2.default.join(opts.instancePath, "client.jar"),
    "--version",
    opts.mcVersion
  ];
  return args;
}
function launchJava(opts, onData, onExit) {
  const args = buildArgs(opts);
  const child = (0, import_node_child_process.spawn)(opts.javaPath || "java", args, { cwd: opts.instancePath });
  child.stdout.on("data", (d) => onData(d.toString()));
  child.stderr.on("data", (d) => onData(d.toString()));
  child.on("close", (c) => onExit(c));
  return child;
}

// src/main/main.ts
var win = null;
function getUserDataPath() {
  return import_electron2.app.getPath("userData");
}
function ensureDir(dir) {
  if (!import_node_fs.default.existsSync(dir)) import_node_fs.default.mkdirSync(dir, { recursive: true });
}
async function createWindow() {
  win = new import_electron2.BrowserWindow({
    width: 1200,
    height: 800,
    title: "DRK Launcher",
    backgroundColor: "#0f0f10",
    webPreferences: {
      preload: import_node_path3.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  const url = process.env.VITE_DEV_SERVER_URL;
  if (url) {
    await win.loadURL(url);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(import_node_path3.default.join(process.cwd(), "dist", "index.html"));
  }
}
function basePaths() {
  const data = getUserDataPath();
  const settingsPath = import_node_path3.default.join(data, "settings.json");
  const instancesBaseDefault = import_node_path3.default.join(data, "instances");
  ensureDir(instancesBaseDefault);
  return { data, settingsPath, instancesBaseDefault };
}
function readJSON(file, fallback) {
  try {
    if (!import_node_fs.default.existsSync(file)) return fallback;
    const raw = import_node_fs.default.readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(file, value) {
  ensureDir(import_node_path3.default.dirname(file));
  import_node_fs.default.writeFileSync(file, JSON.stringify(value, null, 2));
}
function settings() {
  const { settingsPath, instancesBaseDefault } = basePaths();
  const s = readJSON(settingsPath, { theme: "dark", language: "es", defaultRamMb: 4096, instancesBase: instancesBaseDefault });
  if (!s.instancesBase) s.instancesBase = instancesBaseDefault;
  return s;
}
function saveSettings(s) {
  const { settingsPath } = basePaths();
  writeJSON(settingsPath, s);
}
function instancesFile() {
  const { data } = basePaths();
  return import_node_path3.default.join(data, "instances.json");
}
function listInstances() {
  return readJSON(instancesFile(), []);
}
function saveInstances(list) {
  writeJSON(instancesFile(), list);
}
function createInstance(payload) {
  const s = settings();
  const id = Math.random().toString(36).slice(2);
  const instPath = import_node_path3.default.join(s.instancesBase || basePaths().instancesBaseDefault, id);
  ensureDir(instPath);
  ensureDir(import_node_path3.default.join(instPath, "mods"));
  ensureDir(import_node_path3.default.join(instPath, "resourcepacks"));
  ensureDir(import_node_path3.default.join(instPath, "shaderpacks"));
  ensureDir(import_node_path3.default.join(instPath, "config"));
  const i = { id, name: payload.name, version: payload.version, loader: payload.loader || "vanilla", createdAt: Date.now(), path: instPath };
  const list = listInstances();
  list.push(i);
  saveInstances(list);
  return i;
}
function updateInstance(id, patch) {
  const list = listInstances();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...patch };
  list[idx] = updated;
  saveInstances(list);
  return updated;
}
function deleteInstance(id) {
  const list = listInstances();
  const item = list.find((x) => x.id === id);
  saveInstances(list.filter((x) => x.id !== id));
  if (item && import_node_fs.default.existsSync(item.path)) import_node_fs.default.rmSync(item.path, { recursive: true, force: true });
}
async function mojangVersions() {
  const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
  const json = await res.json();
  return json.versions;
}
function analyzeLog(content) {
  const lower = content.toLowerCase();
  if (lower.includes("noclassdeffounderror")) return { summary: "Falta una librer\xEDa o versi\xF3n incorrecta", recommendation: "Actualizar loader o instalar dependencia faltante" };
  if (lower.includes("classnotfoundexception")) return { summary: "Clase no encontrada", recommendation: "Verificar versiones de mods" };
  if (lower.includes("mixin")) return { summary: "Error de Mixin", recommendation: "Actualizar mods y loader, revisar compatibilidad" };
  return { summary: "Error no identificado", recommendation: "Revisar mods recientes y memoria asignada" };
}
function crashesFile() {
  const { data } = basePaths();
  return import_node_path3.default.join(data, "crashes.json");
}
function listCrashes() {
  return readJSON(crashesFile(), []);
}
function saveCrashes(list) {
  writeJSON(crashesFile(), list);
}
import_electron2.app.whenReady().then(async () => {
  const { instancesBaseDefault } = basePaths();
  ensureDir(instancesBaseDefault);
  initDB();
  await createWindow();
});
import_electron2.ipcMain.handle("settings:get", async () => settings());
import_electron2.ipcMain.handle("settings:set", async (_e, s) => {
  saveSettings(s);
  return s;
});
import_electron2.ipcMain.handle("instances:list", async () => {
  if (hasDB()) {
    try {
      return sqlite().prepare("SELECT * FROM instances").all();
    } catch {
      return [];
    }
  }
  return listInstances();
});
import_electron2.ipcMain.handle("instances:create", async (_e, p) => {
  const inst = createInstance(p);
  if (hasDB()) {
    try {
      sqlite().prepare("INSERT OR REPLACE INTO instances (id,name,version,loader,createdAt,path) VALUES (@id,@name,@version,@loader,@createdAt,@path)").run(inst);
    } catch {
    }
  }
  return inst;
});
import_electron2.ipcMain.handle("instances:update", async (_e, p) => {
  const updated = updateInstance(p.id, p.patch);
  if (updated && hasDB()) {
    try {
      sqlite().prepare("INSERT OR REPLACE INTO instances (id,name,version,loader,createdAt,path,ramMb,userProfile) VALUES (@id,@name,@version,@loader,@createdAt,@path,@ramMb,@userProfile)").run(updated);
    } catch {
    }
  }
  return updated;
});
import_electron2.ipcMain.handle("instances:delete", async (_e, id) => {
  if (hasDB()) {
    try {
      sqlite().prepare("DELETE FROM instances WHERE id = ?").run(id);
    } catch {
    }
  }
  deleteInstance(id);
  return true;
});
import_electron2.ipcMain.handle("instances:openFolder", async (_e, id) => {
  const i = listInstances().find((x) => x.id === id);
  if (i) import_electron2.shell.openPath(i.path);
  return true;
});
import_electron2.ipcMain.handle("versions:list", async () => mojangVersions());
import_electron2.ipcMain.handle("crash:analyze", async (_e, p) => {
  const i = listInstances().find((x) => x.id === p.instanceId);
  if (!i) return null;
  const target = p.logPath || import_node_path3.default.join(i.path, "logs", "latest.log");
  if (!import_node_fs.default.existsSync(target)) return null;
  const txt = import_node_fs.default.readFileSync(target, "utf-8");
  const res = analyzeLog(txt);
  const rec = { id: Math.random().toString(36).slice(2), instanceId: i.id, createdAt: Date.now(), summary: res.summary, logPath: target, recommendation: res.recommendation };
  const list = listCrashes();
  list.push(rec);
  saveCrashes(list);
  return rec;
});
import_electron2.ipcMain.handle("crash:list", async () => listCrashes());
import_electron2.ipcMain.handle("servers:list", async () => {
  const { data } = basePaths();
  const file = import_node_path3.default.join(data, "servers.json");
  return readJSON(file, []);
});
import_electron2.ipcMain.handle("servers:save", async (_e, list) => {
  const { data } = basePaths();
  const file = import_node_path3.default.join(data, "servers.json");
  writeJSON(file, list);
  return true;
});
import_electron2.ipcMain.handle("servers:ping", async (_e, ip) => queryStatus(ip));
import_electron2.ipcMain.handle("game:launch", async (_e, p) => {
  const i = listInstances().find((x) => x.id === p.instanceId);
  const s = settings();
  if (!i) return null;
  launchJava({ javaPath: s.javaPath || "java", mcVersion: i.version, instancePath: i.path, ramMb: i.ramMb || s.defaultRamMb }, () => {
  }, () => {
  });
  return { started: true };
});
import_electron2.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron2.app.quit();
});
//# sourceMappingURL=main.cjs.map
