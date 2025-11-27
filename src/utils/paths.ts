import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Obtiene la ruta del directorio principal del launcher en AppData
 * @returns Ruta al directorio .DRK Launcher en la carpeta de roaming
 */
export function getLauncherDataPath(): string {
  return path.join(app.getPath('appData'), '.DRK Launcher');
}

/**
 * Asegura que un directorio exista, creándolo si es necesario
 * @param dir Directorio a asegurar
 */
export function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}