#!/usr/bin/env tsx
// ============================================================
// TrackPro GPS — Health Check Script
// Verifica que todos los servicios estén operando
// Uso: npx tsx scripts/health-check.ts
// ============================================================

import { config } from 'dotenv'
config({ path: '.env.local' })

type ServiceResult = {
  ok: boolean
  latency: number
  detail?: string
}

async function checkSupabase(): Promise<ServiceResult> {
  const start = Date.now()
  try {
    const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
    if (!url) return { ok: false, latency: 0, detail: 'NEXT_PUBLIC_SUPABASE_URL not set' }

    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
      },
    })
    return { ok: res.ok, latency: Date.now() - start, detail: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, latency: Date.now() - start, detail: String(e) }
  }
}

async function checkGPSServer(): Promise<ServiceResult> {
  const start = Date.now()
  try {
    const host = process.env['GPS_SERVER_HOST'] ?? 'localhost'
    const port = process.env['HEALTH_PORT'] ?? '3001'
    const res  = await fetch(`http://${host}:${port}/health`)
    const data = await res.json() as { status: string; connections: number; uptime: number }
    return {
      ok:     res.ok && data.status === 'ok',
      latency: Date.now() - start,
      detail: `Connections: ${data.connections ?? 0}, Uptime: ${Math.round((data.uptime ?? 0) / 60)}min`,
    }
  } catch (e) {
    return { ok: false, latency: Date.now() - start, detail: 'GPS Server not reachable' }
  }
}

async function checkRedis(): Promise<ServiceResult> {
  const start = Date.now()
  try {
    const { default: IORedis } = await import('ioredis')
    const redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      lazyConnect: true, maxRetriesPerRequest: 1,
    })
    await redis.connect()
    const pong = await redis.ping()
    await redis.quit()
    return { ok: pong === 'PONG', latency: Date.now() - start, detail: 'PONG' }
  } catch (e) {
    return { ok: false, latency: Date.now() - start, detail: String(e) }
  }
}

async function checkWebApp(): Promise<ServiceResult> {
  const start = Date.now()
  try {
    const url = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
    const res  = await fetch(`${url}/login`)
    return { ok: res.ok, latency: Date.now() - start, detail: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, latency: Date.now() - start, detail: String(e) }
  }
}

function statusIcon(ok: boolean) { return ok ? '✅' : '❌' }
function latencyColor(ms: number) {
  if (ms < 100) return '\x1b[32m' // green
  if (ms < 500) return '\x1b[33m' // yellow
  return '\x1b[31m'               // red
}
const RESET = '\x1b[0m'

async function main() {
  console.log('\n🔍 TrackPro GPS — Health Check\n' + '='.repeat(50))

  const checks = await Promise.allSettled([
    checkSupabase().then(r => ({ name: 'Supabase (DB + Auth)', ...r })),
    checkGPSServer().then(r => ({ name: 'GPS TCP Server',      ...r })),
    checkRedis().then(r =>     ({ name: 'Redis (BullMQ)',       ...r })),
    checkWebApp().then(r =>    ({ name: 'Next.js Web App',      ...r })),
  ])

  let allOk = true

  for (const result of checks) {
    if (result.status === 'fulfilled') {
      const { name, ok, latency, detail } = result.value
      if (!ok) allOk = false
      console.log(
        `${statusIcon(ok)} ${name.padEnd(24)} ` +
        `${latencyColor(latency)}${latency}ms${RESET}` +
        (detail ? ` — ${detail}` : '')
      )
    } else {
      allOk = false
      console.log(`❌ Check failed: ${result.reason}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  if (allOk) {
    console.log('✅ Todos los servicios operando correctamente\n')
    process.exit(0)
  } else {
    console.log('❌ Algunos servicios tienen problemas\n')
    process.exit(1)
  }
}

main()
