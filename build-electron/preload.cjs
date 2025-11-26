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
  }
  // Agrega aquí otros métodos necesarios
  // ...
});
//# sourceMappingURL=preload.cjs.map
