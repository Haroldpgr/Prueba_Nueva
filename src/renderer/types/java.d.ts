// src/renderer/types/java.d.ts

export interface JavaInfo {
  id: string;
  path: string;
  version: string;
  isWorking: boolean;
  source: 'global' | 'installed' | 'JAVA_HOME' | 'PATH' | 'registry';
  downloadDate?: string;
}

export interface JavaInstallResult {
  success: boolean;
  javaInfo?: JavaInfo;
  message?: string;
}

export interface JavaTestResult {
  isWorking: boolean;
  version?: string;
  output?: string;
  error?: string;
}

export interface JavaCompatibility {
  requiredVersion: string;
  recommendedVersion: string;
  note: string;
}