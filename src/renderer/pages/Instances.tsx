import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'

type Instance = {
  id: string
  name: string
  version: string
  loader?: 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'liteloader'
  createdAt: number
  path: string
}

export default function Instances() {
  const [list, setList] = useState<Instance[]>([])
  const [editing, setEditing] = useState<string>('')
  const [newName, setNewName] = useState('')
  useEffect(() => { window.api.instances.list().then(setList) }, [])
  const remove = async (id: string) => { await window.api.instances.delete(id); setList(await window.api.instances.list()) }
  const open = async (id: string) => { await window.api.instances.openFolder(id) }
  const play = async (id: string) => { await window.api.game.launch({ instanceId: id }) }
  const startEdit = (i: Instance) => { setEditing(i.id); setNewName(i.name) }
  const saveEdit = async (id: string) => { await window.api.instances.update({ id, patch: { name: newName } }); setList(await window.api.instances.list()); setEditing(''); setNewName('') }
  return (
    <div className="grid grid-cols-3 gap-4">
      {list.map(i => (
        <Card key={i.id}>
          {editing === i.id ? (
            <input value={newName} onChange={e => setNewName(e.target.value)} className="bg-gray-800 p-2 rounded-xl mb-2" />
          ) : (
            <div className="text-lg font-semibold mb-2">{i.name}</div>
          )}
          <div className="text-sm text-gray-300 mb-4">{i.version} {i.loader}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => play(i.id)}>Play</Button>
            <Button variant="secondary" onClick={() => open(i.id)}>Abrir carpeta</Button>
            {editing === i.id ? (
              <Button variant="secondary" onClick={() => saveEdit(i.id)}>Guardar</Button>
            ) : (
              <Button variant="secondary" onClick={() => startEdit(i)}>Editar</Button>
            )}
            <Button onClick={() => remove(i.id)}>Borrar</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
