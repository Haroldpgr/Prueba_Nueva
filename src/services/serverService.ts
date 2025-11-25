import { rateLimit, fetchWithRetry } from './http'

export async function queryStatus(ip: string) {
  await rateLimit()
  try {
    const res = await fetchWithRetry(`https://api.mcsrvstat.us/2/${encodeURIComponent(ip)}`)
    const json = await res.json()
    return { online: !!json.online, players: json.players?.online ?? 0, version: json.version ?? '' }
  } catch {
    return { online: false, players: 0, version: '' }
  }
}

