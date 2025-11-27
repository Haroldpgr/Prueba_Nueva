// src/renderer/components/VersionSelector.tsx

import React, { useState, useEffect } from 'react';
import { ModrinthVersion } from '../../services/modDownloadService';
import { modVersionService } from '../services/modVersionService';

interface VersionSelectorProps {
  projectId: string;
  mcVersion: string;
  contentType: 'mod' | 'resourcepack' | 'shader' | 'datapack';
  loader?: string;
  onVersionSelect: (version: ModrinthVersion) => void;
  onLoaderSelect?: (loader: string) => void; // Solo para mods
  selectedVersion?: string;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({
  projectId,
  mcVersion,
  contentType,
  loader,
  onVersionSelect,
  onLoaderSelect,
  selectedVersion
}) => {
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [compatibleVersions, setCompatibleVersions] = useState<ModrinthVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(selectedVersion);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [selectedLoader, setSelectedLoader] = useState<string | undefined>(loader);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVersions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Obtener todas las versiones del proyecto
        const allVersions = await modVersionService.getModVersions(projectId);
        setVersions(allVersions);
        
        // Filtrar versiones compatibles con la versión de Minecraft
        const compatible = await modVersionService.getCompatibleVersions(projectId, mcVersion, loader);
        setCompatibleVersions(compatible);
        
        // Si es un mod, obtener los loaders disponibles
        if (contentType === 'mod') {
          const projectLoaders = await modVersionService.getProjectLoaders(projectId);
          setLoaders(projectLoaders);
        }
        
        if (compatible.length > 0 && !selectedVersionId) {
          setSelectedVersionId(compatible[0].id);
          onVersionSelect(compatible[0]);
        }
      } catch (err) {
        console.error('Error al cargar versiones:', err);
        setError('Error al cargar las versiones del contenido');
      } finally {
        setLoading(false);
      }
    };
    
    loadVersions();
  }, [projectId, mcVersion, loader, contentType, onVersionSelect, selectedVersionId]);

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const versionId = e.target.value;
    setSelectedVersionId(versionId);
    
    const selectedVersion = versions.find(v => v.id === versionId);
    if (selectedVersion) {
      onVersionSelect(selectedVersion);
    }
  };

  const handleLoaderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLoader = e.target.value;
    setSelectedLoader(newLoader);
    
    if (onLoaderSelect) {
      onLoaderSelect(newLoader);
    }
    
    // Recalcular versiones compatibles con el nuevo loader
    const compatible = versions.filter(version => 
      version.game_versions.includes(mcVersion) && 
      (!newLoader || version.loaders.includes(newLoader))
    );
    setCompatibleVersions(compatible);
    
    if (compatible.length > 0) {
      setSelectedVersionId(compatible[0].id);
      onVersionSelect(compatible[0]);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-2 w-full">
        <div className="animate-pulse bg-gray-700 h-8 rounded"></div>
        {contentType === 'mod' && (
          <div className="animate-pulse bg-gray-700 h-8 rounded"></div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm mb-2">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2 w-full">
      {/* Selector de versión */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Versión del {contentType}:
        </label>
        <select
          value={selectedVersionId || ''}
          onChange={handleVersionChange}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {compatibleVersions.length > 0 ? (
            compatibleVersions.map(version => (
              <option key={version.id} value={version.id}>
                {version.version_number} ({version.game_versions.join(', ')})
              </option>
            ))
          ) : (
            <option disabled>No hay versiones disponibles</option>
          )}
        </select>
      </div>

      {/* Selector de loader (solo para mods) */}
      {contentType === 'mod' && loaders.length > 0 && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Loader compatible:
          </label>
          <select
            value={selectedLoader || ''}
            onChange={handleLoaderChange}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos los loaders</option>
            {loaders.map(loaderOpt => (
              <option key={loaderOpt} value={loaderOpt}>
                {loaderOpt.charAt(0).toUpperCase() + loaderOpt.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {compatibleVersions.length === 0 && (
        <div className="text-yellow-500 text-sm">
          No hay versiones compatibles con Minecraft {mcVersion}
        </div>
      )}
    </div>
  );
};

export default VersionSelector;