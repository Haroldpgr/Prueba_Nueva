import React, { useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'

export default function ModpackImporter() {
  const [source, setSource] = useState('')
  const [method, setMethod] = useState<'file'|'url'>('file')
  const importPack = async () => {}
  return (
    <Card>
      <div className="text-xl mb-4">Importar modpack</div>
      <div className="grid grid-cols-2 gap-4">
        <select value={method} onChange={e => setMethod(e.target.value as 'file'|'url')} className="bg-gray-800 p-2 rounded-xl">
          <option value="file">Archivo</option>
          <option value="url">URL</option>
        </select>
        <input value={source} onChange={e => setSource(e.target.value)} className="bg-gray-800 p-2 rounded-xl" placeholder="Ruta o URL" />
        <Button onClick={importPack}>Importar</Button>
      </div>
    </Card>
  )
}

