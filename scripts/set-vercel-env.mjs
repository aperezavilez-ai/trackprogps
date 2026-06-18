/**
 * Configura variables de entorno en Vercel vía REST API
 */
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const PROJECT_ID = 'prj_uucBeJd6OIDrx2nHhH0rYDcgmOI6'
const TEAM_ID    = 'team_4XVvukp0kYKkyO5MvDPet1Q4'
const APP_URL    = 'https://trackprogps.mx'

let token
try {
  const cfg = JSON.parse(readFileSync(join(homedir(), 'AppData/Roaming/xdg.data/com.vercel.cli/auth.json'), 'utf8'))
  token = cfg.token
} catch {
  console.error('No se encontró token de Vercel')
  process.exit(1)
}

const vars = [
  { key: 'NEXT_PUBLIC_APP_URL',             value: APP_URL },
  { key: 'NEXT_PUBLIC_APP_NAME',            value: process.env.NEXT_PUBLIC_APP_NAME ?? 'TrackPro GPS' },
  { key: 'NEXT_PUBLIC_SUPABASE_URL',        value: process.env.NEXT_PUBLIC_SUPABASE_URL },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',   value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
  { key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',    value: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY },
  { key: 'RESEND_API_KEY',                  value: process.env.RESEND_API_KEY },
  { key: 'RESEND_FROM_EMAIL',               value: process.env.RESEND_FROM_EMAIL },
  { key: 'RESEND_FROM_NOREPLY',             value: process.env.RESEND_FROM_NOREPLY },
  { key: 'RESEND_FROM_BILLING',             value: process.env.RESEND_FROM_BILLING },
].filter(v => v.value)

async function getEnvs() {
  const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return data.envs ?? []
}

async function upsertEnv(key, value) {
  const envs = await getEnvs()
  const existing = envs.find(e => e.key === key)

  if (existing) {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${existing.id}?teamId=${TEAM_ID}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, target: ['production', 'preview'] }),
      }
    )
    const data = await res.json()
    console.log(res.ok ? `✅ ${key}` : `⚠️  ${key}: ${data.error?.message ?? JSON.stringify(data)}`)
  } else {
    const res = await fetch(
      `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, type: 'plain', target: ['production', 'preview'] }),
      }
    )
    const data = await res.json()
    console.log(res.ok ? `✅ ${key}` : `⚠️  ${key}: ${data.error?.message ?? JSON.stringify(data)}`)
  }
}

for (const v of vars) await upsertEnv(v.key, v.value)
console.log(`\nDominio: ${APP_URL}`)
console.log('Ahora ejecuta: cd apps/web && vercel --prod --yes')
