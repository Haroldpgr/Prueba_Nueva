import { contextBridge, ipcRenderer } from 'electron';

// Exponer API de forma segura
contextBridge.exposeInMainWorld('api', {
  // Métodos de búsqueda
  modrinth: {
    search: (options: { contentType: string; search: string }) => {
      console.log('Buscando en Modrinth:', options);
      return ipcRenderer.invoke('modrinth:search', options);
    }
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
  
  // Agrega aquí otros métodos necesarios
  // ...
});

// Declaración de tipos para TypeScript
declare global {
  interface Window {
    api: {
      modrinth: {
        search: (options: { contentType: string; search: string }) => Promise<any[]>;
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
    };
  }
}
