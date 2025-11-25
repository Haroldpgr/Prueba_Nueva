import { spawn } from 'node:child_process'
import path from 'node:path'

export type LaunchOptions = {
  javaPath: string
  mcVersion: string
  instancePath: string
  ramMb?: number
  jvmArgs?: string[]
}

export function buildArgs(opts: LaunchOptions) {
  const mem = Math.max(512, opts.ramMb || 2048)
  const args = [
    `-Xms${mem}m`,
    `-Xmx${mem}m`,
    ...(opts.jvmArgs || []),
    '-jar',
    path.join(opts.instancePath, 'client.jar'),
    '--version', opts.mcVersion
  ]
  return args
}

export function launchJava(opts: LaunchOptions, onData: (chunk: string) => void, onExit: (code: number | null) => void) {
  const args = buildArgs(opts)
  const child = spawn(opts.javaPath || 'java', args, { cwd: opts.instancePath })
  child.stdout.on('data', d => onData(d.toString()))
  child.stderr.on('data', d => onData(d.toString()))
  child.on('close', c => onExit(c))
  return child
}

