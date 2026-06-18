/**
 * Prueba end-to-end del GPS server en producción.
 * Envía handshake IMEI + paquete Codec 8 y verifica posición en Supabase.
 *
 * Uso:
 *   node scripts/test-gps-live.mjs
 *   node scripts/test-gps-live.mjs --host trackpro-gps-server.fly.dev --imei 123456789012345
 */
import net from 'node:net'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DEFAULT_HOST = 'trackpro-gps-server.fly.dev'
const DEFAULT_PORT = 5000
const DEFAULT_IMEI = '123456789012345'

// Paquete Codec 8 mínimo con CRC válido (CDMX por defecto)
function crc16(buffer) {
  let crc = 0
  for (const byte of buffer) {
    crc ^= byte
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xA001 : crc >>> 1
    }
  }
  return crc
}

function buildCodec8Packet(lat = 19.4326, lng = -99.1332) {
  const latRaw = Math.round(lat * 10_000_000)
  const lngRaw = Math.round(lng * 10_000_000)
  const record = Buffer.alloc(30)
  let o = 0
  record.writeBigUInt64BE(BigInt(Date.now()), o); o += 8
  record.writeUInt8(0, o); o += 1
  record.writeInt32BE(lngRaw, o); o += 4
  record.writeInt32BE(latRaw, o); o += 4
  record.writeInt16BE(2240, o); o += 2
  record.writeUInt16BE(90, o); o += 2
  record.writeUInt8(12, o); o += 1
  record.writeUInt16BE(65, o); o += 2
  record.writeUInt8(0, o); o += 1
  record.writeUInt8(0, o); o += 1
  for (let i = 0; i < 4; i++) { record.writeUInt8(0, o); o += 1 }

  const dataLen = 33
  const data = Buffer.alloc(dataLen)
  let d = 0
  data.writeUInt8(0x08, d); d += 1
  data.writeUInt8(1, d); d += 1
  record.copy(data, d); d += 30
  data.writeUInt8(1, d)

  const packet = Buffer.alloc(8 + dataLen + 4)
  packet.writeUInt32BE(0, 0)
  packet.writeUInt32BE(dataLen, 4)
  data.copy(packet, 8)
  packet.writeUInt32BE(crc16(data), 8 + dataLen)
  return packet
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

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag, fallback) => {
    const i = args.indexOf(flag)
    return i === -1 ? fallback : args[i + 1]
  }
  return {
    host: get('--host', DEFAULT_HOST),
    port: parseInt(get('--port', String(DEFAULT_PORT)), 10),
    imei: get('--imei', DEFAULT_IMEI),
  }
}

function buildImeiPacket(imei) {
  const buf = Buffer.alloc(2 + imei.length)
  buf.writeUInt16BE(imei.length, 0)
  buf.write(imei, 2, 'ascii')
  return buf
}

function sendGpsPacket(host, port, imei) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(buildImeiPacket(imei))
    })

    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('Timeout esperando respuesta del servidor GPS'))
    }, 15_000)

    let stage = 'imei'

    socket.on('data', (chunk) => {
      if (stage === 'imei') {
        if (chunk.length < 1 || chunk[0] !== 0x01) {
          clearTimeout(timeout)
          socket.destroy()
          reject(new Error(`ACK IMEI inválido: ${chunk.toString('hex')}`))
          return
        }
        stage = 'data'
        socket.write(buildCodec8Packet())
        return
      }

      if (stage === 'data' && chunk.length >= 4) {
        const recordCount = chunk.readUInt32BE(0)
        clearTimeout(timeout)
        socket.end()
        resolve({ recordCount })
      }
    })

    socket.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function verifyDevice(supabase, imei) {
  const { data, error } = await supabase
    .from('gps_devices')
    .select('id, imei, status, vehicles!inner(id, economic_num, plates)')
    .eq('imei', imei)
    .single()

  if (error || !data) {
    throw new Error(
      `IMEI ${imei} no registrado o sin vehículo vinculado. Regístralo en el panel o ejecuta el seed demo.`
    )
  }

  const vehicle = Array.isArray(data.vehicles) ? data.vehicles[0] : data.vehicles
  return { deviceId: data.id, vehicleId: vehicle.id, plates: vehicle.plates }
}

async function waitForPosition(supabase, vehicleId, before) {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const { data } = await supabase
      .from('vehicle_positions')
      .select('lat, lng, speed, recorded_at, server_at')
      .eq('vehicle_id', vehicleId)
      .single()

    if (data?.server_at && new Date(data.server_at) > before) {
      return data
    }
  }
  return null
}

async function main() {
  const { host, port, imei } = parseArgs()
  const env = loadEnv()

  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`\n=== Test GPS en vivo ===`)
  console.log(`Servidor: ${host}:${port}`)
  console.log(`IMEI:     ${imei}`)

  const device = await verifyDevice(supabase, imei)
  console.log(`✓ Dispositivo OK — vehículo ${device.plates} (${device.vehicleId})`)

  const before = new Date()
  const result = await sendGpsPacket(host, port, imei)
  console.log(`✓ Servidor aceptó ${result.recordCount} registro(s)`)

  console.log('… Esperando actualización en Supabase (workers + Redis)')
  const position = await waitForPosition(supabase, device.vehicleId, before)

  if (!position) {
    console.warn('⚠ Paquete recibido pero posición no actualizada en 24s.')
    console.warn('  Revisa logs: flyctl logs -a trackpro-gps-server')
    process.exit(1)
  }

  console.log(`✓ Posición actualizada:`)
  console.log(`  lat=${position.lat} lng=${position.lng} speed=${position.speed}`)
  console.log(`  server_at=${position.server_at}`)
  console.log('\n✅ GPS en vivo funcionando correctamente')
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`)
  process.exit(1)
})
