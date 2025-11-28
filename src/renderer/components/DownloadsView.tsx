// src/renderer/components/DownloadsView.tsx
import React, { useState, useEffect } from 'react';
import Card from './Card';
import { downloadService, Download } from '../services/downloadService';

const DownloadsView = () => {
  const [allDownloads, setAllDownloads] = useState<Download[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Download[]>([]);
  const [completedDownloads, setCompletedDownloads] = useState<Download[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = downloadService.subscribe((downloads) => {
      setAllDownloads(downloads);
      setActiveDownloads(downloads.filter(d => d.status === 'downloading' || d.status === 'paused'));
      setCompletedDownloads(downloads.filter(d => d.status === 'completed'));
    });

    // Cargar estado inicial
    const initialDownloads = downloadService.getAllDownloads();
    setAllDownloads(initialDownloads);
    setActiveDownloads(downloadService.getActiveDownloads());
    setCompletedDownloads(downloadService.getCompletedDownloads());

    // Cleanup
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const filteredActive = activeDownloads.filter(download =>
    download.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCompleted = completedDownloads.filter(download =>
    download.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: Download['status']): string => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'downloading': return 'text-blue-500';
      case 'paused': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (status: Download['status']): string => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'downloading': return 'Descargando';
      case 'paused': return 'En pausa';
      case 'completed': return 'Completado';
      case 'error': return 'Error';
      default: return status;
    }
  };

  const handleClearCompleted = () => {
    downloadService.clearCompleted();
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-200">Descargas</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar descargas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 rounded-lg bg-gray-800/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleClearCompleted}
              disabled={completedDownloads.length === 0}
              className={`px-4 py-2 rounded-lg transition-all ${
                completedDownloads.length > 0
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              Limpiar Completados
            </button>
          </div>
        </div>

        {/* Descargas Activas */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-200 mb-4 flex items-center">
            <span className="mr-2">📥</span> Descargas Activas
            <span className="ml-2 text-sm text-gray-400 bg-gray-700/50 py-0.5 px-2 rounded-full">
              {activeDownloads.length}
            </span>
          </h3>
          {filteredActive.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay descargas activas
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActive.map(download => (
                <div 
                  key={download.id} 
                  className="p-4 bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-100 truncate">{download.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(download.status)} bg-opacity-20`}>
                          {getStatusText(download.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {formatBytes(download.downloadedBytes)} / {formatBytes(download.totalBytes)}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-400 whitespace-nowrap ml-4">
                      {download.speed > 0 ? formatSpeed(download.speed) : ''}
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          download.status === 'completed' ? 'bg-green-500' : 
                          download.status === 'error' ? 'bg-red-500' : 
                          'bg-gradient-to-r from-blue-500 to-indigo-600'
                        }`}
                        style={{ width: `${download.progress}%` }}
                      ></div>
                    </div>
                    <div className="text-right text-xs text-gray-400 mt-1">
                      {download.progress}%
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div>
                      Inicio: {new Date(download.startTime).toLocaleTimeString()}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="hover:text-blue-400 transition-colors"
                        title="Abrir carpeta"
                      >
                        📁
                      </button>
                      <button
                        className="hover:text-red-400 transition-colors"
                        title="Cancelar"
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Descargas Completadas */}
        <div>
          <h3 className="text-xl font-semibold text-gray-200 mb-4 flex items-center">
            <span className="mr-2">✅</span> Descargas Completadas
            <span className="ml-2 text-sm text-gray-400 bg-gray-700/50 py-0.5 px-2 rounded-full">
              {completedDownloads.length}
            </span>
          </h3>
          {filteredCompleted.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay descargas completadas
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompleted.map(download => (
                <div 
                  key={download.id} 
                  className="p-4 bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-100 truncate">{download.name}</h4>
                    <span className="text-green-500">✓</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Tamaño: {formatBytes(download.totalBytes)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Finalizado: {download.endTime ? new Date(download.endTime).toLocaleString() : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DownloadsView;