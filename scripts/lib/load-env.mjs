import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function loadRootEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i <= 0) continue
      const key = t.slice(0, i)
      const val = t.slice(i + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* .env opcional */ }
}

export const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'chegfmvgsohvofdmjslb'
export const DB_HOST = `db.${PROJECT_REF}.supabase.co`
