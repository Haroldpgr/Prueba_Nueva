import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Instances from './pages/Instances'
import CreateInstance from './pages/CreateInstance'
import Servers from './pages/Servers'
import CrashAnalyzer from './pages/CrashAnalyzer'
import ModpackImporter from './pages/ModpackImporter'
import SettingsModal from './components/SettingsModal' // Import the modal

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'oled'>('dark')
  const [isSettingsOpen, setSettingsOpen] = useState(false) // State for the modal
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    const a: any = (window as any).api;
    if (a && a.settings) {
      a.settings.get().then((s: any) => {
        setTheme(s.theme || 'dark')
      })
    }
  }, [])

  useEffect(() => {
    // Remover todas las clases de tema
    document.documentElement.classList.remove('dark', 'light', 'oled');

    // Añadir la clase correspondiente al tema actual
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'oled') {
      // El tema OLED requiere la clase 'dark' también para activar los estilos oscuros
      document.documentElement.classList.add('dark');
      // Añadimos una clase específica para estilos OLED si es necesario
      document.body.classList.add('oled-theme');
    } else {
      // Para el tema claro, no añadimos 'dark', pero aseguramos que no tenga clases de tema oscuro
      document.body.classList.remove('oled-theme');
    }
  }, [theme])

  const handleNavigation = (path: string) => {
    if (path === '/settings') {
      setSettingsOpen(true)
    } else {
      nav(path)
    }
  }

  const handleSettingsChanged = (settings: any) => {
    if (settings.theme) {
      setTheme(settings.theme);
    }
  };

  return (
    <div className="h-full flex">
      <Sidebar currentPath={loc.pathname} onNavigate={handleNavigation} />
      <main className={`flex-1 p-6 bg-gray-900/30 dark:bg-gray-900/50 transition-all duration-300 ${isSettingsOpen ? 'filter blur-sm' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/instances" element={<Instances />} />
          <Route path="/create" element={<CreateInstance />} />
          {/* <Route path="/settings" element={<Settings />} /> */} {/* The route is no longer needed */}
          <Route path="/servers" element={<Servers />} />
          <Route path="/crash" element={<CrashAnalyzer />} />
          <Route path="/import" element={<ModpackImporter />} />
        </Routes>
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChanged={handleSettingsChanged}
      />
    </div>
  )
}