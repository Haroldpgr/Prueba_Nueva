import React from 'react'

export default function Button({ children, onClick, variant = 'primary' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' }) {
  const cls = variant === 'primary' ? 'bg-primary text-black' : 'bg-gray-700 text-white'
  return <button onClick={onClick} className={`px-4 py-2 rounded-xl ${cls} hover:opacity-90 transition`}>{children}</button>
}

