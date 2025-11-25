import React, { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import IconButton from '../components/IconButton'

type NewsItem = { id: string; title: string; body: string }
type Instance = { id: string; name: string; version: string; loader?: string }

export default function Home() {
  const [feed, setFeed] = useState<NewsItem[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [username, setUsername] = useState('Usuario'); // Nuevo estado para el nombre de usuario
  const last = useMemo(() => instances[instances.length - 1], [instances])

  useEffect(() => {
    setFeed([
      { id: 'welcome', title: 'Bienvenido a DRK Launcher', body: 'Crea tu primera instancia y explora modpacks.' },
      { id: 'tips', title: 'Consejo', body: 'Configura Java y RAM desde Ajustes para mejor rendimiento.' }
    ])
  }, [])

  useEffect(() => {
    window.api.instances.list().then((l: any) => setInstances(l));
    // Asumiendo que window.api tiene una función para obtener el nombre de usuario
    // Si no existe, se mantendrá 'Usuario' por defecto
    if (window.api && window.api.getUser) {
      window.api.getUser().then((user: { username: string }) => {
        if (user && user.username) {
          setUsername(user.username);
        }
      }).catch((e: any) => console.error("Error al obtener el nombre de usuario:", e));
    }
  }, [])

  const play = async () => { if (!last) return; await window.api.game.launch({ instanceId: last.id }) }

  const mods = [
    { id: 'opt', name: 'Optimizado', description: 'Paquete de rendimiento y gráficos suaves', tags: ['Optimización'], img: 'https://picsum.photos/seed/opt/600/300' },
    { id: 'adventure', name: 'Aventura+', description: 'Explora mazmorras y nuevas dimensiones', tags: ['Aventura'], img: 'https://picsum.photos/seed/adv/600/300' },
    { id: 'builder', name: 'Constructor', description: 'Bloques y herramientas para creativos', tags: ['Construcción'], img: 'https://picsum.photos/seed/build/600/300' }
  ]

  return (
    <div className="grid grid-cols-4 gap-6">
      <div className="col-span-3 space-y-6">
        <Card>
          <div className="text-2xl font-bold text-gray-100">¡Bienvenido, {username}!</div>
        </Card>

        <Card>
          <div className="text-xl font-semibold mb-4 text-gray-200">Continuar</div>
          {last ? (
            <div className="flex items-center justify-between bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50">
              <div>
                <div className="font-medium text-gray-100">{last.name}</div>
                <div className="text-sm text-gray-400">{last.version} {last.loader}</div>
              </div>
              <div className="flex gap-2">
                <Button onClick={play}>Jugar</Button>
                <Button variant="secondary" onClick={() => location.assign('#/instances')}>Más opciones</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 py-4 text-center">No hay instancias aún. Crea una para empezar.</div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-semibold text-gray-200">Descubre un modpack</div>
            <Button variant="secondary" onClick={() => location.assign('#/import')}>Ver más</Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {mods.map(m => (
              <div key={m.id} className="rounded-xl overflow-hidden bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 transition-transform hover:scale-[1.02]">
                <img src={m.img} alt="" className="w-full h-32 object-cover" />
                <div className="p-3">
                  <div className="font-medium mb-1 text-gray-100">{m.name}</div>
                  <div className="text-sm text-gray-400 mb-2">{m.description}</div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => location.assign('#/import')}>Importar</Button>
                    <Button variant="secondary">Ver</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <div className="text-xl font-semibold mb-2 text-gray-200">Noticias</div>
          <div className="space-y-2">
            {feed.map(x => (
              <div key={x.id} className="p-3 bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50">
                <div className="font-medium text-gray-100">{x.title}</div>
                <div className="text-sm text-gray-400">{x.body}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-xl font-semibold mb-2 text-gray-200">Cumplimiento</div>
          <div className="text-sm text-gray-400">DRK Launcher no distribuye contenido protegido. Necesitas una copia legítima de Minecraft para jugar.</div>
        </Card>
        <Card>
          <div className="text-xl font-semibold mb-2 text-gray-200">Perfil</div>
          <div className="text-sm text-gray-400">No conectado</div>
        </Card>
      </div>
    </div>
  )
}