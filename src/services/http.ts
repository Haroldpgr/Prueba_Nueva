export async function fetchWithRetry(url: string, init?: RequestInit, retries = 2, backoffMs = 500) {
  let lastErr: any
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (e) {
      lastErr = e
      if (i < retries) await new Promise(r => setTimeout(r, backoffMs * (i + 1)))
    }
  }
  throw lastErr
}

let lastTs = 0
let tokens = 5
const capacity = 5
const refillMs = 1000

export async function rateLimit() {
  const now = Date.now()
  const elapsed = now - lastTs
  lastTs = now
  tokens = Math.min(capacity, tokens + elapsed / refillMs)
  if (tokens < 1) await new Promise(r => setTimeout(r, refillMs))
  tokens -= 1
}

