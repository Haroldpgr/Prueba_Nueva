import React from 'react'

type IconName = 'instances' | 'create' | 'import' | 'servers' | 'crash' | 'settings'

function Icon({ name, className }: { name: IconName; className?: string }) {
  if (name === 'instances') return (
    <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M4 6h16v4H4V6Zm0 8h10v4H4v-4Z"/></svg>
  )
  if (name === 'create') return (
    <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
  )
  if (name === 'import') return (
    <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M12 3l4 4h-3v6h-2V7H8l4-4Zm-7 14h14v2H5v-2Z"/></svg>
  )
  if (name === 'servers') return (
    <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M4 5h16v4H4V5Zm0 6h16v4H4v-4Zm0 6h16v2H4v-2Z"/></svg>
  )
  if (name === 'crash') return (
    <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M12 2 8 8h8l-4-6Zm-6 10h12l-2 10H8l-2-10Z"/></svg>
  )
  return (
    <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8.94 4a9 9 0 1 1-17.88 0 9 9 0 0 1 17.88 0Z"/></svg>
  )
}

export default function IconButton({ icon, label, onClick }: { icon: IconName; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-24 flex flex-col items-center gap-2 group"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-gray-800 shadow-lg flex items-center justify-center transition-transform group-hover:scale-105 group-hover:from-blue-500 group-hover:to-gray-700">
        <Icon name={icon} className="w-7 h-7 text-white" />
      </div>
      <div className="text-xs font-semibold text-primary group-hover:text-blue-400 transition-colors drop-shadow-sm">
        {label}
      </div>
    </button>
  )
}

