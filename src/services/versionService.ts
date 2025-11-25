import { rateLimit, fetchWithRetry } from './http'

export async function getMojangVersions() {
  await rateLimit()
  const res = await fetchWithRetry('https://launchermeta.mojang.com/mc/game/version_manifest.json')
  const json = await res.json()
  return json.versions as { id: string; type: string; url: string; releaseTime: string }[]
}

