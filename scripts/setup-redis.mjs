/**
 * Guía para renovar Redis cuando Upstash agota el límite gratuito.
 * Uso: node scripts/setup-redis.mjs
 */
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

console.log('=== Redis para TrackPro GPS Server ===\n')
console.log('Estado actual: REDIS_URL en .env / Fly secrets')
console.log(`  ${process.env.REDIS_URL?.replace(/:[^:@]+@/, ':***@') ?? '(no configurado)'}\n`)

console.log('Si ves "max requests limit exceeded" en logs de Fly:')
console.log('  1. Crea Redis nuevo en Fly (interactivo):')
console.log('     fly redis create --name trackpro-gps-queue --region dfw --no-replicas --enable-eviction')
console.log('  2. O en https://console.upstash.com → New Database → copia rediss:// URL')
console.log('  3. Actualiza .env REDIS_URL y ejecuta:')
console.log('     npm run deploy:gps -- --secrets-only\n')

console.log('Mitigación activa: el GPS server procesa posiciones INLINE si Redis falla.')
console.log('Las alertas y emails siguen funcionando aunque la cola esté saturada.\n')
