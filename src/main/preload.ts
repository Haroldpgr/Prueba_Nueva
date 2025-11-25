import { contextBridge, ipcRenderer } from 'electron'

const api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (s: unknown) => ipcRenderer.invoke('settings:set', s)
  },
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    create: (p: unknown) => ipcRenderer.invoke('instances:create', p),
    update: (p: unknown) => ipcRenderer.invoke('instances:update', p),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    openFolder: (id: string) => ipcRenderer.invoke('instances:openFolder', id)
  },
  versions: {
    list: () => ipcRenderer.invoke('versions:list')
  },
  crash: {
    analyze: (p: unknown) => ipcRenderer.invoke('crash:analyze', p),
    list: () => ipcRenderer.invoke('crash:list')
  },
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    save: (list: unknown) => ipcRenderer.invoke('servers:save', list),
    ping: (ip: string) => ipcRenderer.invoke('servers:ping', ip)
  },
  game: {
    launch: (p: unknown) => ipcRenderer.invoke('game:launch', p)
  },
  java: {
    detect: () => ipcRenderer.invoke('java:detect'),
    explore: () => ipcRenderer.invoke('java:explore'),
    test: (path: string) => ipcRenderer.invoke('java:test', path),
    install: (version: string) => ipcRenderer.invoke('java:install', version)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window { api: typeof api }
}
