export type ImportMethod = 'file' | 'url'

export async function importModpack(method: ImportMethod, source: string) {
  return { method, source, status: 'pending' }
}
