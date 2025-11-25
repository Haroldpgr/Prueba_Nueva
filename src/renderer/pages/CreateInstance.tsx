import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'

type Loader = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'liteloader'

export default function CreateInstance() {
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')
  const [loader, setLoader] = useState<Loader>('vanilla')
  const [versions, setVersions] = useState<{ id: string; type: string }[]>([])
  useEffect(() => { window.api.versions.list().then((v: any) => setVersions(v.slice(0, 50))) }, [])
  const create = async () => { if (!name || !version) return; await window.api.instances.create({ name, version, loader }); location.assign('#/instances') }
  return (
    <Card>
      <div className="text-xl mb-4">Crear instancia</div>
      <div className="grid grid-cols-2 gap-4">
        <input value={name} onChange={e => setName(e.target.value)} className="bg-gray-800 p-2 rounded-xl" placeholder="Nombre" />
        <select value={version} onChange={e => setVersion(e.target.value)} className="bg-gray-800 p-2 rounded-xl">
          <option value="">Versión</option>
          {versions.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
        </select>
        <select value={loader} onChange={e => setLoader(e.target.value as Loader)} className="bg-gray-800 p-2 rounded-xl">
          <option value="vanilla">Vanilla</option>
          <option value="forge">Forge</option>
          <option value="fabric">Fabric</option>
          <option value="quilt">Quilt</option>
          <option value="liteloader">Liteloader</option>
        </select>
        <Button onClick={create}>Crear</Button>
      </div>
    </Card>
  )
}

