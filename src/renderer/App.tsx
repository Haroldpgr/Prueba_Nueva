import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import ContentPage from './pages/ContentPage'
import SkinsPage from './pages/SkinsPage'
import Instances from './pages/Instances'
import CreateInstance from './pages/CreateInstance'
import Servers from './pages/Servers'
import CrashAnalyzer from './pages/CrashAnalyzer'
import ModpackImporter from './pages/ModpackImporter'
import DownloadsView from './components/DownloadsView'
import SettingsModal from './components/SettingsModal' // Import the modal
import LoginModal from './components/LoginModal' // Import the new LoginModal
import { profileService, type Profile } from './services/profileService' // Import the actual profile service
import { themeService } from './services/themeService';
import { processMonitorService } from './services/processMonitorService';
import NotificationContainer from './components/NotificationContainer';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'oled'>('dark')
  const [isSettingsOpen, setSettingsOpen] = useState(false) // State for the modal
  const [isLoginModalOpen, setLoginModalOpen] = useState(false); // State for LoginModal
  const [javaInstallations, setJavaInstallations] = useState([]) // State for Java installations
  const [accounts, setAccounts] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    // Load profiles and current user from service
    const initialProfiles = profileService.getAllProfiles();
    setAccounts(initialProfiles);

    const initialCurrentUser = profileService.getCurrentProfile();
    setCurrentUser(initialCurrentUser);

    // Load settings and initialize theme
    const a: any = (window as any).api;
    if (a) {
      if (a.settings) {
        a.settings.get().then((s: any) => {
          // Initialize theme service with appearance settings
          themeService.initializeTheme(s.appearance || {
            theme: 'dark',
            accentColor: '#3B82F6',
            advancedRendering: false,
            globalFontSize: 1.0,
            enableTransitions: true,
            backgroundOpacity: 0.3,
            borderRadius: 8,
            colorFilter: 'none'
          });
        })
      }
      if (a.java && typeof a.java.detect === 'function') {
        a.java.detect().then((installations: any) => {
          setJavaInstallations(installations);
        }).catch((err: any) => {
          console.error("Error detecting Java:", err);
        });
      }
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
    // Handle appearance settings changes
    if (settings.appearance) {
      themeService.initializeTheme(settings.appearance);
    }
    // Re-detect Java installations if settings changed (e.g., javaPath might have been set manually)
    if (settings.javaPath) {
      const a: any = (window as any).api;
      if (a.java && typeof a.java.detect === 'function') {
        a.java.detect().then((installations: any) => {
          setJavaInstallations(installations);
        }).catch((err: any) => {
          console.error("Error detecting Java:", err);
        });
      }
    }
  };

  const handleJavaDetect = () => {
    const a: any = (window as any).api;
    if (a.java && typeof a.java.detect === 'function') {
      a.java.detect().then((installations: any) => {
        setJavaInstallations(installations);
      }).catch((err: any) => {
        console.error("Error detecting Java:", err);
      });
    }
  };

  const handleAddAccount = (username: string, type: 'microsoft' | 'non-premium' = 'non-premium') => {
    const newProfile = profileService.addProfile(username, type);
    setAccounts([...accounts, newProfile]);
    setCurrentUser(username);
  };

  const handleDeleteAccount = (username: string) => {
    const success = profileService.deleteProfile(username);
    if (success) {
      const updatedProfiles = profileService.getAllProfiles();
      setAccounts(updatedProfiles);
      setCurrentUser(profileService.getCurrentProfile());
    }
  };

  const handleSelectAccount = (username: string) => {
    const success = profileService.setCurrentProfile(username);
    if (success) {
      setCurrentUser(username);
      // Update accounts to reflect last used time
      setAccounts(profileService.getAllProfiles());
    }
  };

  const handleLoginClick = () => {
    setLoginModalOpen(true);
  };

  const handleCloseLoginModal = () => {
    setLoginModalOpen(false);
  };

  const handleMicrosoftLogin = () => {
    console.log("Microsoft Login attempt - currently under maintenance.");
    // No additional logic here, modal component will show maintenance message
  };

  const handleNonPremiumLogin = (username: string) => {
    const newProfile = profileService.addProfile(username, 'non-premium');
    setAccounts([...accounts, newProfile]);
    setCurrentUser(username);
    profileService.setCurrentProfile(username); // Ensure the newly added profile is set as current
    handleCloseLoginModal();
  };

  const handlePlay = async (instanceId: string) => {
    try {
      // Usar la API de Electron para lanzar el juego
      if (window.api?.game?.launch) {
        await window.api.game.launch({ instanceId });
        console.log(`Juego iniciado para la instancia: ${instanceId}`);
      } else {
        console.error('La API de juego no está disponible');
      }
    } catch (error) {
      console.error('Error al iniciar el juego:', error);
    }
  };

  return (
    <div className="h-full flex">
      <Sidebar
        currentPath={loc.pathname}
        onNavigate={handleNavigation}
        accounts={accounts}
        currentUser={currentUser}
        onAddAccount={handleAddAccount}
        onDeleteAccount={handleDeleteAccount}
        onSelectAccount={handleSelectAccount}
      />
      <main className={`flex-1 p-6 bg-gray-900/30 dark:bg-gray-900/50 transition-all duration-300 ${isSettingsOpen || isLoginModalOpen ? 'filter blur-sm' : ''} overflow-y-auto`}>
        <Routes>
          <Route path="/" element={<Home onAddAccount={handleAddAccount} onDeleteAccount={handleDeleteAccount} onSelectAccount={handleSelectAccount} onLoginClick={handleLoginClick} onPlay={handlePlay} currentUser={currentUser} accounts={accounts} />} />
          <Route path="/instances" element={<Instances onPlay={handlePlay} />} />
          <Route path="/create" element={<CreateInstance />} />
          {/* <Route path="/settings" element={<Settings />} /> */} {/* The route is no longer needed */}
          <Route path="/servers" element={<Servers />} />
          <Route path="/contenido" element={<ContentPage />} />
          <Route path="/contenido/:type" element={<ContentPage />} />
          <Route path="/contenido/:type/:id" element={<ContentPage />} />
          <Route path="/skins" element={<SkinsPage />} />
          <Route path="/crash" element={<CrashAnalyzer />} />
          <Route path="/import" element={<ModpackImporter />} />
          <Route path="/downloads" element={<DownloadsView />} />
        </Routes>
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChanged={handleSettingsChanged}
        javaInstallations={javaInstallations}
        onJavaDetect={handleJavaDetect}
      />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={handleCloseLoginModal}
        onMicrosoftLogin={handleMicrosoftLogin}
        onNonPremiumLogin={handleNonPremiumLogin}
      />
      <NotificationContainer />
    </div>
  )
}