import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'

type CrashRecord = { id: string; instanceId: string; createdAt: number; summary: string; logPath: string; recommendation?: string }
type Instance = { id: string; name: string }

export default function CrashAnalyzer() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [selected, setSelected] = useState<string>('')
  const [list, setList] = useState<CrashRecord[]>([])
  useEffect(() => { window.api.instances.list().then((l: any) => setInstances(l)); window.api.crash.list().then(setList) }, [])
  const analyze = async () => { if (!selected) return; const rec = await window.api.crash.analyze({ instanceId: selected }); if (rec) setList(prev => [rec, ...prev]) }
  return (
    <div className="space-y-4">
      <Card>
        <div className="text-xl mb-4">Analizador de crashes</div>
        <div className="flex gap-2">
          <select value={selected} onChange={e => setSelected(e.target.value)} className="bg-gray-800 p-2 rounded-xl">
            <option value="">Selecciona instancia</option>
            {instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <Button onClick={analyze}>Analizar</Button>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        {list.map(c => (
          <Card key={c.id}>
            <div className="text-lg mb-2">{new Date(c.createdAt).toLocaleString()}</div>
            <div className="text-sm">{c.summary}</div>
            <div className="text-sm text-gray-300">{c.recommendation}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

