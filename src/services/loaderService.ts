export type Loader = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'liteloader'

export function validateCompatibility(mcVersion: string, loader: Loader) {
  // Minimal placeholder compatibility
  if (loader === 'vanilla') return true
  if (/^(1\.(14|15|16|17|18|19|20|21))/.test(mcVersion)) return true
  return false
}

