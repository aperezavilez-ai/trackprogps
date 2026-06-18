/**
 * Deploy GPS Server to Fly.io
 *
 * Prerequisites:
 *   1. flyctl auth login
 *   2. Redis en producción (Upstash recomendado) → REDIS_URL
 *   3. Variables en .env local o exportadas
 *
 * Uso:
 *   node scripts/deploy-gps-server.mjs
 *   node scripts/deploy-gps-server.mjs --secrets-only
 *   node scripts/deploy-gps-server.mjs --deploy-only
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const FLY_CONFIG = 'apps/gps-server/fly.toml'
const APP = 'trackpro-gps-server'
const HEALTH_URL = `https://${APP}.fly.dev/health`

const args = new Set(process.argv.slice(2))
const secretsOnly = args.has('--secrets-only')
const deployOnly = args.has('--deploy-only')

function flyBin() {
  const win = join(homedir(), '.fly', 'bin', 'flyctl.exe')
  const unix = join(homedir(), '.fly', 'bin', 'flyctl')
  if (existsSync(win)) return win
  if (existsSync(unix)) return unix
  return 'flyctl'
}

function run(cmd, cmdArgs, opts = {}) {
  const result = runOptional(cmd, cmdArgs, opts)
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${cmdArgs.join(' ')}`)
  }
}

function runOptional(cmd, cmdArgs, opts = {}) {
  console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`)
  return spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: opts.capture ? 'utf8' : undefined,
    shell: process.platform === 'win32',
    ...opts,
  })
}

function ensureApp(fly) {
  const status = runOptional(fly, ['status', '-a', APP])
  if (status.status === 0) return
  console.log(`\nCreando app ${APP} en Fly.io...`)
  const created = runOptional(fly, ['apps', 'create', APP])
  if (created.status !== 0) {
    throw new Error(`No se pudo crear la app ${APP}`)
  }
}

function ensurePublicIps(fly) {
  const ips = runOptional(fly, ['ips', 'list', '-a', APP], { capture: true })
  const out = `${ips.stdout ?? ''}${ips.stderr ?? ''}`
  if (!out.includes('v4')) {
    console.log('\nAsignando IPv4 pública (requerida para DNS y GPS TCP)...')
    run(fly, ['ips', 'allocate-v4', '-a', APP, '--yes'])
  }
  if (!out.includes('v6')) {
    console.log('Asignando IPv6 pública...')
    runOptional(fly, ['ips', 'allocate-v6', '-a', APP])
  }
}

function getPublicIpv4(fly) {
  const ips = runOptional(fly, ['ips', 'list', '-a', APP], { capture: true })
  const out = ips.stdout ?? ''
  const match = out.match(/v4\s*│\s*([\d.]+)/)
  return match?.[1] ?? null
}

function loadEnv() {
  const envPath = join(ROOT, '.env')
  const out = {}
  if (!existsSync(envPath)) return out
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function requireVars(env) {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'REDIS_URL',
  ]
  const missing = required.filter((k) => !env[k] || env[k] === 'redis://localhost:6379')
  if (missing.length) {
    console.error('\nFaltan variables de entorno para producción:')
    for (const k of missing) console.error(`  - ${k}`)
    console.error('\nREDIS_URL no puede ser localhost. Crea Redis en Upstash:')
    console.error('  https://upstash.com → Redis → copia la URL rediss://...')
    console.error('\nLuego agrégala a .env y vuelve a ejecutar este script.')
    process.exit(1)
  }
}

async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10_000) })
    const body = await res.text()
    console.log(`\nHealth ${res.status}: ${body}`)
    if (res.ok) {
      console.log('\n✓ GPS Server operativo')
      console.log(`  HTTP health: ${HEALTH_URL}`)
      console.log(`  TCP devices: ${APP}.fly.dev:5000`)
    } else {
      console.log('\n⚠ Health check falló — revisa logs: flyctl logs -a trackpro-gps-server')
    }
  } catch (err) {
    console.log(`\n⚠ No se pudo contactar ${HEALTH_URL}: ${err.message}`)
  }
}

async function main() {
  const fly = flyBin()
  const env = { ...loadEnv(), ...process.env }

  console.log('=== TrackPro GPS Server — Fly.io Deploy ===\n')

  if (!deployOnly) {
    requireVars(env)
    ensureApp(fly)

    run(fly, [
      'secrets', 'set',
      `NEXT_PUBLIC_SUPABASE_URL=${env.NEXT_PUBLIC_SUPABASE_URL}`,
      `SUPABASE_SERVICE_ROLE_KEY=${env.SUPABASE_SERVICE_ROLE_KEY}`,
      `REDIS_URL=${env.REDIS_URL}`,
      '-a', APP,
    ])
    console.log('\n✓ Secrets base configurados')

    const optionalSecrets = [
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
    'RESEND_FROM_NOREPLY',
    'RESEND_FROM_BILLING',
      'WHATSAPP_TOKEN',
      'WHATSAPP_PHONE_ID',
      'FCM_SERVER_KEY',
      'VAPID_PUBLIC_KEY',
      'VAPID_PRIVATE_KEY',
      'VAPID_SUBJECT',
    ].filter(k => env[k] && !String(env[k]).includes('...'))

    if (optionalSecrets.length) {
      const pairs = optionalSecrets.map(k => `${k}=${env[k]}`)
      run(fly, ['secrets', 'set', ...pairs, '-a', APP])
      console.log(`✓ Secrets opcionales: ${optionalSecrets.join(', ')}`)
    }
  }

  if (!secretsOnly) {
    ensureApp(fly)
    ensurePublicIps(fly)
    run(fly, ['deploy', '--config', FLY_CONFIG, '.', '-a', APP])
    console.log('\n✓ Deploy enviado')
    await checkHealth()
  }

  const ipv4 = getPublicIpv4(fly)
  console.log('\nConfigura tus dispositivos Teltonika:')
  console.log(`  Servidor: ${APP}.fly.dev`)
  if (ipv4) console.log(`  IP directa: ${ipv4} (si el DNS no resuelve)`)
  console.log('  Puerto:   5000')
  console.log('  Protocolo: TCP')
}

main().catch((err) => {
  console.error('\nError:', err.message)
  if (String(err.message).includes('auth login')) {
    console.error('\nEjecuta primero: flyctl auth login')
  }
  process.exit(1)
})
