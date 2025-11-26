export {};

declare global {
  interface Window {
    api: {
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
      java: {
        detect: () => Promise<any>;
        explore: () => Promise<any>;
        test: (path: string) => Promise<any>;
        install: (version: string) => Promise<any>;
        getAll: () => Promise<any>;
        getDefault: () => Promise<any>;
        setDefault: (javaId: string) => Promise<any>;
        remove: (javaId: string) => Promise<any>;
        getCompatibility: (minecraftVersion: string) => Promise<any>;
        detectSimple: () => Promise<any>;
      };
      modrinth: {
        search: (options: { contentType: string; search: string }) => Promise<Array<{
          id: string;
          title: string;
          description: string;
          author: string;
          downloads: number;
          lastUpdated: string;
          minecraftVersions: string[];
          categories: string[];
          imageUrl: string;
          type: string;
          version: string;
          downloadUrl: string | null;
        }>>;
      };
      curseforge: {
        search: (options: { contentType: string; search: string }) => Promise<any[]>;
      };
      download: {
        start: (data: { url: string; filename: string; itemId: string }) => void;
        onProgress: (callback: (event: any, data: { itemId: string; progress: number }) => void) => void;
        onComplete: (callback: (event: any, data: { itemId: string; filePath: string }) => void) => void;
        onError: (callback: (event: any, error: { itemId: string; message: string }) => void) => void;
      };
    };
  }
}
