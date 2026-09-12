const prefix = 'signal-archive.secret-progress.v1.'

function validValues(values: unknown): values is string[] {
  return Array.isArray(values) && values.length <= 4000
    && values.every(value => typeof value === 'string' && /^[A-Z0-9?!]{0,2}$/.test(value))
}

export function readSecretProgress(id: string, revision: string): string[] {
  try {
    const source = localStorage.getItem(prefix + id)
    if (!source || source.length > 25000) return []
    const saved = JSON.parse(source)
    return saved?.revision === revision && validValues(saved.values) ? saved.values : []
  } catch { return [] }
}

export function saveSecretProgress(id: string, revision: string, values: string[]): void {
  if (!validValues(values)) return
  try {
    if (values.some(value => value.length)) localStorage.setItem(prefix + id, JSON.stringify({ revision, values }))
    else localStorage.removeItem(prefix + id)
  } catch {}
}