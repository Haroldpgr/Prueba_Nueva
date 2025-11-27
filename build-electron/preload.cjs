// src/main/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("api", {
  // Métodos de búsqueda
  modrinth: {
    search: (options) => {
      console.log("Buscando en Modrinth:", options);
      return import_electron.ipcRenderer.invoke("modrinth:search", options);
    }
  },
  // Métodos de descarga
  download: {
    start: (data) => import_electron.ipcRenderer.send("download:start", data),
    onProgress: (callback) => import_electron.ipcRenderer.on("download:progress", callback),
    onComplete: (callback) => import_electron.ipcRenderer.on("download:complete", callback),
    onError: (callback) => import_electron.ipcRenderer.on("download:error", callback)
  },
  // Otros métodos necesarios (mantén solo los que necesites)
  settings: {
    get: () => import_electron.ipcRenderer.invoke("settings:get"),
    set: (s) => import_electron.ipcRenderer.invoke("settings:set", s)
  },
  // API de instancias
  instances: {
    list: () => import_electron.ipcRenderer.invoke("instances:list"),
    create: (p) => import_electron.ipcRenderer.invoke("instances:create", p),
    update: (p) => import_electron.ipcRenderer.invoke("instances:update", p),
    delete: (id) => import_electron.ipcRenderer.invoke("instances:delete", id),
    openFolder: (id) => import_electron.ipcRenderer.invoke("instances:openFolder", id),
    installContent: (payload) => import_electron.ipcRenderer.invoke("instance:install-content", payload)
  },
  // Otros APIs
  versions: {
    list: () => import_electron.ipcRenderer.invoke("versions:list")
  },
  crash: {
    analyze: (p) => import_electron.ipcRenderer.invoke("crash:analyze", p),
    list: () => import_electron.ipcRenderer.invoke("crash:list")
  },
  servers: {
    list: () => import_electron.ipcRenderer.invoke("servers:list"),
    save: (list) => import_electron.ipcRenderer.invoke("servers:save", list),
    ping: (ip) => import_electron.ipcRenderer.invoke("servers:ping", ip)
  },
  game: {
    launch: (p) => import_electron.ipcRenderer.invoke("game:launch", p)
  },
  // API de diálogo del sistema
  dialog: {
    showOpenDialog: (options) => import_electron.ipcRenderer.invoke("dialog:showOpenDialog", options)
  }
});
//# sourceMappingURL=preload.cjs.map
