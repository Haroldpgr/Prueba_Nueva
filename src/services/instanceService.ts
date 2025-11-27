import path from 'node:path';
import fs from 'node:fs';
import { getLauncherDataPath } from '../utils/paths';

export interface InstanceConfig {
  id: string;
  name: string;
  version: string;
  loader?: 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'liteloader';
  javaPath?: string;
  javaId?: string;
  maxMemory?: number;
  windowWidth?: number;
  windowHeight?: number;
  jvmArgs?: string[];
  createdAt: number;
  path: string;
}

/**
 * Servicio para manejar la creación y estructura de instancias de Minecraft
 */
export class InstanceService {
  private basePath: string;

  constructor() {
    const launcherPath = getLauncherDataPath();
    this.basePath = path.join(launcherPath, 'instances');
    this.ensureDir(this.basePath);
  }

  /**
   * Crea una nueva instancia con la estructura correcta
   * @param config Configuración de la instancia
   * @returns La instancia creada
   */
  public createInstance(config: Omit<InstanceConfig, 'path' | 'createdAt'>): InstanceConfig {
    const id = config.id || this.generateInstanceId(config.name);
    const instancePath = path.join(this.basePath, id);

    // Verificar que no exista ya una instancia con este ID
    if (fs.existsSync(instancePath)) {
      // Si ya existe, agregar un sufijo numérico
      let counter = 1;
      let uniqueId = `${id}_${counter}`;
      let uniquePath = path.join(this.basePath, uniqueId);

      while (fs.existsSync(uniquePath)) {
        counter++;
        uniqueId = `${id}_${counter}`;
        uniquePath = path.join(this.basePath, uniqueId);
      }

      // Actualizar el ID y path para la nueva instancia única
      const newInstanceId = uniqueId;
      const newInstancePath = path.join(this.basePath, newInstanceId);

      // Crear la carpeta de la instancia con el nuevo ID
      this.ensureDir(newInstancePath);

      // Crear la estructura de carpetas necesaria para el juego
      this.createInstanceStructure(newInstancePath);

      // Crear el archivo de configuración de la instancia
      const instanceConfig: InstanceConfig = {
        ...config,
        id: newInstanceId,
        createdAt: Date.now(),
        path: newInstancePath
      };

      this.saveInstanceConfig(newInstancePath, instanceConfig);

      return instanceConfig;
    }

    // Crear la carpeta de la instancia
    this.ensureDir(instancePath);

    // Crear la estructura de carpetas necesaria para el juego
    this.createInstanceStructure(instancePath);

    // Crear el archivo de configuración de la instancia
    const instanceConfig: InstanceConfig = {
      ...config,
      id: config.id || id,
      createdAt: Date.now(),
      path: instancePath
    };

    this.saveInstanceConfig(instancePath, instanceConfig);

    return instanceConfig;
  }

  /**
   * Genera un ID para la instancia basado en el nombre
   */
  private generateInstanceId(name: string): string {
    // Convertir el nombre a un formato seguro para usar como nombre de carpeta
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
      .replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales
      .replace(/\s+/g, '-') // Reemplazar espacios con guiones
      .replace(/-+/g, '-') // Eliminar múltiples guiones seguidos
      .trim(); // Eliminar espacios al inicio y final
  }

  /**
   * Crea la estructura de carpetas necesaria para una instancia de Minecraft
   * @param instancePath Ruta de la instancia
   */
  private createInstanceStructure(instancePath: string): void {
    // Carpetas necesarias para que el juego funcione correctamente
    const requiredFolders = [
      'mods',           // Mods de juego
      'resourcepacks',  // Paquetes de recursos
      'shaderpacks',    // Shaders (para OptiFine/Iris)
      'config',         // Configuración de mods y loader
      'saves',          // Mundos guardados
      'logs'            // Registros del cliente
    ];
    
    requiredFolders.forEach(folder => {
      const folderPath = path.join(instancePath, folder);
      this.ensureDir(folderPath);
    });
  }

  /**
   * Asegura que un directorio exista, creándolo si es necesario
   * @param dir Directorio a asegurar
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Guarda la configuración de la instancia
   */
  private saveInstanceConfig(instancePath: string, config: InstanceConfig): void {
    const configPath = path.join(instancePath, 'instance.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Verifica si una instancia está lista para ejecutarse
   * @param instancePath Ruta de la instancia
   * @returns true si la instancia tiene los archivos necesarios
   */
  public isInstanceReady(instancePath: string): boolean {
    // Verificar que exista el archivo client.jar principal
    const clientJarPath = path.join(instancePath, 'client.jar');
    if (!fs.existsSync(clientJarPath)) {
      console.log(`client.jar no encontrado en ${clientJarPath}`);
      return false;
    }

    // Verificar que exista la estructura de carpetas básica
    const requiredFolders = ['mods', 'config', 'saves', 'logs'];
    for (const folder of requiredFolders) {
      const folderPath = path.join(instancePath, folder);
      if (!fs.existsSync(folderPath)) {
        console.log(`Carpeta requerida no encontrada: ${folderPath}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Genera el comando de ejecución para la instancia
   * @param instancePath Ruta de la instancia
   * @param javaPath Ruta al ejecutable de Java
   * @param maxMemory Memoria máxima en MB
   * @returns Comando de ejecución completo
   */
  public buildGameCommand(instancePath: string, javaPath: string, maxMemory: number): string {
    // Parámetros JVM (Memoria, etc.)
    const jvmArgs = [
      `-Xmx${maxMemory}M`, // Límite de RAM (Ej. 4096M)
      `-Dminecraft.client.dir=${instancePath}`, // CRUCIAL: Le dice al juego dónde está la carpeta de trabajo
      '-jar',
      path.join(instancePath, 'client.jar') // Apunta al archivo que inicia el proceso de juego/loader
    ];

    const fullCommand = `${javaPath} ${jvmArgs.join(' ')}`;
    console.log("Comando a ejecutar:", fullCommand);
    
    return fullCommand;
  }

  /**
   * Obtiene la configuración de una instancia desde su archivo
   * @param instancePath Ruta de la instancia
   * @returns Configuración de la instancia o null si no existe
   */
  public getInstanceConfig(instancePath: string): InstanceConfig | null {
    const configPath = path.join(instancePath, 'instance.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent) as InstanceConfig;
    } catch (error) {
      console.error(`Error al leer la configuración de la instancia: ${error}`);
      return null;
    }
  }

  /**
   * Actualiza la configuración de la instancia
   * @param instancePath Ruta de la instancia
   * @param updates Actualizaciones a aplicar
   */
  public updateInstanceConfig(instancePath: string, updates: Partial<InstanceConfig>): void {
    const config = this.getInstanceConfig(instancePath);
    if (!config) {
      throw new Error(`No se encontró la configuración de la instancia: ${instancePath}`);
    }

    const updatedConfig = { ...config, ...updates };
    this.saveInstanceConfig(instancePath, updatedConfig);
  }
}

export const instanceService = new InstanceService();