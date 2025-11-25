// src/main/preload.ts
var import_electron = require("electron");
var api = {
  settings: {
    get: () => import_electron.ipcRenderer.invoke("settings:get"),
    set: (s) => import_electron.ipcRenderer.invoke("settings:set", s)
  },
  instances: {
    list: () => import_electron.ipcRenderer.invoke("instances:list"),
    create: (p) => import_electron.ipcRenderer.invoke("instances:create", p),
    update: (p) => import_electron.ipcRenderer.invoke("instances:update", p),
    delete: (id) => import_electron.ipcRenderer.invoke("instances:delete", id),
    openFolder: (id) => import_electron.ipcRenderer.invoke("instances:openFolder", id)
  },
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
  }
};
import_electron.contextBridge.exposeInMainWorld("api", api);
//# sourceMappingURL=preload.cjs.map
