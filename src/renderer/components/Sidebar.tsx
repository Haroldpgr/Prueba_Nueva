import React from 'react'

type Props = { currentPath: string; onNavigate: (p: string) => void }

export function Icon({ name }: { name: 'home' | 'instances' | 'create' | 'servers' | 'crash' | 'import' | 'settings' | 'contenido' | 'skins' | 'privacy' | 'appearance' | 'resources' | 'java' }) {
  const isSolid = ['privacy', 'appearance', 'resources', 'java', 'instances'].includes(name);
  const commonProps = {
    className: "w-5 h-5", // Slightly smaller icons
    viewBox: "0 0 20 20",
    fill: isSolid ? "currentColor" : "none",
    strokeWidth: isSolid ? 0 : "1.5",
    stroke: isSolid ? "none" : "currentColor",
  };

  if (name === 'home') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    )
  }
  // Keep other non-settings icons as they were...
  if (name === 'contenido') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.75h16.5m-16.5 0A2.25 2.25 0 0 1 5.25 7.5h13.5a2.25 2.25 0 0 1 2.25 2.25m-16.5 0v6.75a2.25 2.25 0 0 0 2.25 2.25h12a2.25 2.25 0 0 0 2.25-2.25v-6.75m-16.5 0h16.5" />
      </svg>
    )
  }
  if (name === 'skins') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402a3.75 3.75 0 0 0-5.304-5.304L4.098 14.6c-.996.996-1.55 2.32-1.55 3.714v.001l.002.002.001.002.002.001.002.001.001.002h.001l.002.001.001.002.002.001.001.001a3.75 3.75 0 0 0 3.714-1.55l.298-.447M9 15a6 6 0 1 0-8.485-8.485 6 6 0 0 0 8.485 8.485Z" />
      </svg>
    )
  }
  if (name === 'create') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    )
  }
  if (name === 'servers') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75v-9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 9a.75.75 0 0 0-.75.75v9.19c0 .514.418.939.938.939h9.19a.75.75 0 0 0 .75-.75v-1.5" />
      </svg>
    )
  }
  if (name === 'crash') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    )
  }
  if (name === 'import') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    )
  }
  if (name === 'settings') {
    return (
      <svg {...commonProps} stroke="currentColor" fill="none" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
      </svg>
    )
  }

  // Solid icons for settings
  if (name === 'privacy') {
    return (
      <svg {...commonProps}>
        <path fillRule="evenodd" d="M12 1.5a7.5 7.5 0 0 0-6.75 10.563.75.75 0 0 0 1.172.66l.5-.666A5.25 5.25 0 0 1 12 2.25a5.25 5.25 0 0 1 4.422 7.834l.5.666a.75.75 0 0 0 1.172-.66A7.5 7.5 0 0 0 12 1.5ZM9.75 15.063V12a3 3 0 1 1 4.5 2.59V15a.75.75 0 0 1-1.5 0v-.528a3 3 0 1 1 1.5 0v.528a.75.75 0 0 1-1.5 0v-.528a3 3 0 1 1 1.5 0v.528a.75.75 0 0 1-1.28.53l-2.22-2.22a.75.75 0 0 1 1.06-1.06l2.22 2.22a.75.75 0 0 1-.53 1.28Z" clipRule="evenodd" />
      </svg>
    )
  }
  if (name === 'appearance') {
    return (
      <svg {...commonProps}>
        <path fillRule="evenodd" d="M18 5.25a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5h15ZM12 10.5a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0ZM12 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm6-3a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
      </svg>
    )
  }
  if (name === 'resources') {
    return (
      <svg {...commonProps}>
        <path fillRule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-.75.75h-11.25A.75.75 0 0 1 7.5 15.75V3.75a.75.75 0 0 1 .75-.75ZM18 15V4.5H9v10.5h9ZM4.5 7.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-3 0V9A1.5 1.5 0 0 1 4.5 7.5ZM1.5 13.5a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1-3 0v-1.5ZM9 13.5a1.5 1.5 0 0 1 1.5 1.5v1.5a1.5 1.5 0 0 1-3 0v-1.5A1.5 1.5 0 0 1 9 13.5ZM16.5 13.5a1.5 1.5 0 0 1 1.5 1.5v1.5a1.5 1.5 0 0 1-3 0v-1.5a1.5 1.5 0 0 1 1.5-1.5Z" clipRule="evenodd" />
      </svg>
    )
  }
  if (name === 'java') {
    return (
      <svg {...commonProps}>
        <path d="M2.136 14.748a.75.75 0 0 1 1.018.854c-.17.832-.364 1.501-.55 1.978a.75.75 0 0 1-1.39-.587c.14-.338.28-.76.412-1.266l.008-.032c.02-.08.04-.168.063-.265a.75.75 0 0 1 .854-1.018ZM14.25 8.25a.75.75 0 0 0-1.5 0v.252a4.26 4.26 0 0 0-.175-.002 4.3 4.3 0 0 0-4.3 4.3c0 .31.037.61.105.9.002.01.003.02.005.03l.005.022c.02.08.04.168.063.265a.75.75 0 0 0 1.43.502c-.02-.076-.04-.148-.06-.215l-.007-.025c-.06-.22-.095-.45-.095-.68v-.252A2.25 2.25 0 0 1 12 10.5v-.252ZM7.5 7.5a.75.75 0 0 1 .75.75v.252c.31.037.61.037.9 0 .23-.018.45-.053.66-.115a.75.75 0 1 1 .47 1.42c-.3.09-.62.145-.96.145a2.25 2.25 0 0 1-2.25-2.25v-.252a.75.75 0 0 1 .75-.75Z" />
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM16.5 9a4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 1 9 0Z" clipRule="evenodd" />
      </svg>
    )
  }
  if (name === 'instances') {
    return (
      <svg {...commonProps}>
        <path fillRule="evenodd" d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 18.375V5.625Zm1.875 0v12.75h17.25V5.625H3.375Zm15 2.25H12.75v3h5.625V7.875Zm-15 1.5h5.625v3H3.375v-3Zm6.75 0h5.625v3H10.125v-3Zm-6.75 4.5h5.625v3H3.375v-3Zm6.75 0h5.625v3H10.125v-3Zm6.75 0h3.375v3h-3.375v-3Zm-6.75 4.5h5.625v3H10.125v-3Zm6.75 0h3.375v3h-3.375v-3Zm-10.125 1.5h5.625v3H3.375v-3Zm6.75 0h5.625v3H10.125v-3Zm6.75 0h3.375v3h-3.375v-3Z" clipRule="evenodd" />
      </svg>
    )
  }
  
  return (
    <svg {...commonProps} fill="currentColor">
      <circle cx="10" cy="10" r="8" />
    </svg>
  )
}

function Item({ path, current, onClick, icon, title }: { path: string; current: boolean; onClick: () => void; icon: React.ComponentProps<typeof Icon>['name']; title: string }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`w-9 h-9 flex items-center justify-center rounded-lg mb-2 shadow transition-all duration-300 ease-out transform hover:scale-105 hover:bg-gradient-to-br hover:from-blue-500 hover:to-primary ${current ? 'bg-primary text-black scale-105' : 'bg-gray-800 text-primary'}`}
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <div className="flex items-center justify-center w-full h-full">
        <Icon name={icon} />
      </div>
    </button>
  )
}

export default function Sidebar({ currentPath, onNavigate }: Props) {
  return (
    <div className="w-16 bg-gray-900/90 backdrop-blur-sm border-r border-gray-800 p-2 flex flex-col items-center">
      <div className="w-8 h-8 rounded-lg bg-primary text-black flex items-center justify-center mb-3 text-xs font-bold">DRK</div>
      <Item title="Inicio" path="/" current={currentPath === '/'} onClick={() => onNavigate('/')} icon="home" />
      <Item title="Contenido" path="/contenido" current={currentPath === '/contenido'} onClick={() => onNavigate('/contenido')} icon="contenido" />
      <Item title="Skins" path="/skins" current={currentPath === '/skins'} onClick={() => onNavigate('/skins')} icon="skins" />
      <Item title="Instancias" path="/instances" current={currentPath === '/instances'} onClick={() => onNavigate('/instances')} icon="instances" />
      <div className="w-10 border-b border-gray-700/50 my-2" />
      <Item title="Crear" path="/create" current={currentPath === '/create'} onClick={() => onNavigate('/create')} icon="create" />
      <Item title="Servidores" path="/servers" current={currentPath === '/servers'} onClick={() => onNavigate('/servers')} icon="servers" />
      <div className="mt-auto w-full flex flex-col items-center gap-1 pb-1">
        <Item title="Crashes" path="/crash" current={currentPath === '/crash'} onClick={() => onNavigate('/crash')} icon="crash" />
        <Item title="Importar" path="/import" current={currentPath === '/import'} onClick={() => onNavigate('/import')} icon="import" />
        <Item title="Ajustes" path="/settings" current={currentPath === '/settings'} onClick={() => onNavigate('/settings')} icon="settings" />
      </div>
    </div>
  )
}
