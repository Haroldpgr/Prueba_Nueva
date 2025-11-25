import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'

type ServerInfo = { id: string; name: string; ip: string; country?: string; category?: string; thumbnail?: string; requiredVersion?: string; modsHint?: string; favorite?: boolean }

export default function Servers() {
  const [list, setList] = useState<ServerInfo[]>([])
  const [status, setStatus] = useState<Record<string, { online: boolean; players: number; version: string }>>({})
  useEffect(() => { window.api.servers.list().then(setList) }, [])
  const add = () => setList(prev => [...prev, { id: Math.random().toString(36).slice(2), name: 'Servidor', ip: 'mc.example.com' }])
  const save = async () => { await window.api.servers.save(list) }
  const ping = async (id: string, ip: string) => { const s = await window.api.servers.ping(ip); setStatus(prev => ({ ...prev, [id]: s })) }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={add}>Añadir</Button>
        <Button onClick={save}>Guardar</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {list.map(s => (
          <Card key={s.id}>
            <div className="text-lg mb-2">{s.name}</div>
            <div className="text-sm text-gray-300">{s.ip}</div>
            <div className="text-xs text-gray-400">{status[s.id] ? (status[s.id].online ? `Online • ${status[s.id].players} jugadores • ${status[s.id].version}` : 'Offline') : ''}</div>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary">Copiar IP</Button>
              <Button variant="secondary">Favorito</Button>
              <Button variant="secondary" onClick={() => ping(s.id, s.ip)}>Ping</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
