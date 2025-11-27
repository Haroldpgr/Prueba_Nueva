// Este es un ejemplo de cómo se usaría el VersionSelector en una página de contenido
// src/renderer/pages/ContentPage.tsx (fragmento de ejemplo)

import React, { useState } from 'react';
import VersionSelector from '../components/VersionSelector';
import { ModrinthVersion } from '../../services/modDownloadService';
import { modVersionService } from '../services/modVersionService';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  lastUpdated: string;
  minecraftVersions: string[];
  categories: string[];
  imageUrl: string;
  type: 'mod' | 'resourcepack' | 'shader' | 'datapack';
  version: string; // Versión principal
  downloadUrl: string | null;
}

interface ContentDownloadSectionProps {
  content: ContentItem;
  mcVersion: string; // Versión actual de Minecraft en la instancia
  instanceLoader?: string; // Loader actual de la instancia (para mods)
  instancePath: string; // Ruta de la instancia donde se instalará
  onDownloadComplete: () => void;
}

const ContentDownloadSection: React.FC<ContentDownloadSectionProps> = ({
  content,
  mcVersion,
  instanceLoader,
  instancePath,
  onDownloadComplete
}) => {
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [selectedLoader, setSelectedLoader] = useState<string | undefined>(instanceLoader);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleVersionSelect = (version: ModrinthVersion) => {
    setSelectedVersion(version);
  };

  const handleLoaderSelect = (loader: string) => {
    setSelectedLoader(loader);
  };

  const handleDownload = async () => {
    if (!selectedVersion) {
      setDownloadError('Por favor selecciona una versión');
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadError(null);

      // Instalar el contenido con la versión y loader seleccionados
      await modVersionService.installContentWithOptions({
        projectId: content.id,
        instancePath,
        mcVersion,
        contentType: content.type,
        loader: selectedLoader,
        versionId: selectedVersion.id
      });

      onDownloadComplete();
    } catch (error) {
      console.error('Error al descargar el contenido:', error);
      setDownloadError('Error al descargar el contenido');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      <h3 className="text-xl font-bold text-white">Instalar {content.title}</h3>
      
      {/* Selector de versión (lo que pediste: encima del botón de descarga) */}
      <VersionSelector
        projectId={content.id}
        mcVersion={mcVersion}
        contentType={content.type}
        loader={instanceLoader}
        onVersionSelect={handleVersionSelect}
        onLoaderSelect={handleLoaderSelect}
      />

      {/* Información adicional */}
      <div className="text-sm text-gray-300">
        <p><span className="font-medium">Proyecto:</span> {content.title}</p>
        <p><span className="font-medium">Autor:</span> {content.author}</p>
        {selectedVersion && (
          <p><span className="font-medium">Versión seleccionada:</span> {selectedVersion.version_number}</p>
        )}
      </div>

      {/* Botón de descarga */}
      {downloadError && (
        <div className="text-red-500 text-sm">{downloadError}</div>
      )}
      
      <button
        onClick={handleDownload}
        disabled={isDownloading || !selectedVersion}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
          isDownloading || !selectedVersion
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-primary hover:from-blue-700 hover:to-primary/90 text-white hover:scale-[1.02]'
        }`}
      >
        {isDownloading 
          ? 'Descargando...' 
          : selectedVersion 
            ? `Instalar ${selectedVersion.version_number}` 
            : 'Seleccionar versión'
        }
      </button>
    </div>
  );
};

export default ContentDownloadSection;