import { contextBridge, ipcRenderer } from 'electron';

// Exponer API de forma segura
contextBridge.exposeInMainWorld('api', {
  // Métodos de búsqueda
  modrinth: {
    search: (options: { contentType: string; search: string }) => {
      console.log('Buscando en Modrinth:', options);
      return ipcRenderer.invoke('modrinth:search', options);
    },
    getCompatibleVersions: (payload: { projectId: string, mcVersion: string, loader?: string }) =>
      ipcRenderer.invoke('modrinth:get-compatible-versions', payload)
  },

  // Métodos de descarga
  download: {
    start: (data: { url: string; filename: string; itemId: string }) =>
      ipcRenderer.send('download:start', data),
    onProgress: (callback: (event: any, data: any) => void) =>
      ipcRenderer.on('download:progress', callback),
    onComplete: (callback: (event: any, data: any) => void) =>
      ipcRenderer.on('download:complete', callback),
    onError: (callback: (event: any, error: any) => void) =>
      ipcRenderer.on('download:error', callback)
  },

  // Otros métodos necesarios (mantén solo los que necesites)
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (s: unknown) => ipcRenderer.invoke('settings:set', s)
  },

  // API de instancias
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    create: (p: unknown) => ipcRenderer.invoke('instances:create', p),
    update: (p: unknown) => ipcRenderer.invoke('instances:update', p),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    openFolder: (id: string) => ipcRenderer.invoke('instances:openFolder', id),
    installContent: (payload: unknown) => ipcRenderer.invoke('instance:install-content', payload)
  },

  // Otros APIs
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

  // API de diálogo del sistema
  dialog: {
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options)
  }
});

// Declaración de tipos para TypeScript
declare global {
  interface Window {
    api: {
      modrinth: {
        search: (options: { contentType: string; search: string }) => Promise<any[]>;
        getCompatibleVersions: (payload: { projectId: string, mcVersion: string, loader?: string }) => Promise<any[]>;
      };
      download: {
        start: (data: { url: string; filename: string; itemId: string }) => void;
        onProgress: (callback: (event: any, data: any) => void) => void;
        onComplete: (callback: (event: any, data: any) => void) => void;
        onError: (callback: (event: any, error: any) => void) => void;
      };
      settings: {
        get: () => Promise<any>;
        set: (s: unknown) => Promise<any>;
      };
      instances: {
        list: () => Promise<any>;
        create: (p: unknown) => Promise<any>;
        update: (p: unknown) => Promise<any>;
        delete: (id: string) => Promise<any>;
        openFolder: (id: string) => Promise<any>;
        installContent: (payload: unknown) => Promise<any>;
      };
      versions: {
        list: () => Promise<any>;
      };
      crash: {
        analyze: (p: unknown) => Promise<any>;
        list: () => Promise<any>;
      };
      servers: {
        list: () => Promise<any>;
        save: (list: unknown) => Promise<any>;
        ping: (ip: string) => Promise<any>;
      };
      game: {
        launch: (p: unknown) => Promise<any>;
      };
      dialog: {
        showOpenDialog: (options: any) => Promise<any>;
      };
    };
  }
}
