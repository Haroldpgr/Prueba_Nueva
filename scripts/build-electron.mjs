import { build } from 'esbuild'
import { rmSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const outDir = 'build-electron'
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

await build({
  entryPoints: ['src/main/main.ts'],
  outfile: join(outDir, 'main.cjs'),
  platform: 'node',
  format: 'cjs',
  bundle: true,
  sourcemap: true,
  external: ['electron']
})

await build({
  entryPoints: ['src/main/preload.ts'],
  outfile: join(outDir, 'preload.cjs'),
  platform: 'node',
  format: 'cjs',
  bundle: true,
  sourcemap: true,
  external: ['electron']
})

console.log('Built Electron main/preload to dist-electron')
