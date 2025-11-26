// src/main/javaService.ts
import { JavaDetector } from './javaDetector';
import type { JavaInfo } from '../renderer/types/java.d';

class JavaService {
  private detector: JavaDetector;
  private installedJavas: JavaInfo[] = [];
  private defaultJavaId: string | null = null;

  constructor() {
    this.detector = new JavaDetector();
    // Cargar configuración guardada si existe
    this.loadConfig();
  }

  private loadConfig() {
    // Aquí iría la lógica para cargar desde un archivo de configuración
    // Por ahora, lo dejamos simple.
    console.log('Cargando configuración de Java...');
  }

  private saveConfig() {
    // Aquí iría la lógica para guardar en un archivo de configuración
    console.log('Guardando configuración de Java...');
  }

  async detectJava(): Promise<JavaInfo[]> {
    const detected = await this.detector.detectJava();
    this.installedJavas = detected;
    return this.installedJavas;
  }

  getAllJavas(): JavaInfo[] {
    return this.installedJavas;
  }

  getDefaultJava(): JavaInfo | undefined {
    if (!this.defaultJavaId) return undefined;
    return this.installedJavas.find(j => j.id === this.defaultJavaId);
  }

  setDefaultJava(javaId: string): boolean {
    const java = this.installedJavas.find(j => j.id === javaId);
    if (!java) {
      console.error(`Java con ID ${javaId} no encontrado.`);
      return false;
    }

    this.defaultJavaId = javaId;
    this.saveConfig();
    console.log(`Java predeterminado establecido en: ${java.path}`);
    return true;
  }

  removeInstalledJava(javaId: string): boolean {
    const initialLength = this.installedJavas.length;
    this.installedJavas = this.installedJavas.filter(j => j.id !== javaId);

    if (this.defaultJavaId === javaId) {
      this.defaultJavaId = null;
    }

    this.saveConfig();
    return this.installedJavas.length < initialLength;
  }

  getMinecraftJavaCompatibility(minecraftVersion: string): { recommended: string; latest: string } {
    // Lógica de compatibilidad simplificada
    const mcMajorVersion = parseInt(minecraftVersion.split('.')[1], 10);

    if (mcMajorVersion >= 17) {
      return { recommended: '17', latest: '21' };
    }
    if (mcMajorVersion >= 16) {
      return { recommended: '16', latest: '17' };
    }
    return { recommended: '8', latest: '8' };
  }

  async testJava(path: string): Promise<boolean> {
    try {
      await this.detector.getJavaVersion(path);
      return true;
    } catch {
      return false;
    }
  }
}

// Exportar una única instancia del servicio
const javaService = new JavaService();
export default javaService;
