'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, Radio, Wifi, WifiOff, MapPin, Gauge, Zap, Battery,
  Signal, Satellite, Clock, Lock, Unlock, RefreshCw, RotateCcw,
  Loader2, AlertTriangle, User, Truck, History, Bell, Mic,
} from 'lucide-react'

const DeviceMap = dynamic(() => import('./device-map').then(m => m.DeviceMap), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />,
})

const RoutePlayback = dynamic(
  () => import('@/components/map/route-playback').then(m => m.RoutePlayback),
  { ssr: false, loading: () => <div className="h-72 bg-gray-100 rounded-xl animate-pulse" /> }
)

interface DeviceDetail {
  id: string
  imei: string
  model: string
  firmware_ver: string | null
  sim_iccid: string | null
  phone_num: string | null
  status: string
  last_seen: string | null
  company: { id: string; name: string } | null
  vehicle: {
    id: string
    economic_num: string
    plates: string
    brand: string
    model: string
    status: string
    driver: { id: string; full_name: string; phone: string | null; email: string | null } | null
    position: {
      lat: number; lng: number; speed: number; heading: number
      ignition: boolean; odometer: number; gsm_signal: number
      battery_lvl: number; satellites: number | null; recorded_at: string
    } | null
  } | null
}

interface Command {
  id: string
  command_type: string
  status: string
  error_msg: string | null
  created_at: string
  sent_at: string | null
  confirmed_at: string | null
  issued_by_user: { full_name: string } | null
}

interface VehicleAlert {
  id: string
  type: string
  severity: string
  title: string
  message: string
  created_at: string
  acknowledged_at: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  online:    { label: 'En línea',      color: 'text-green-600 bg-green-50 border-green-200' },
  offline:   { label: 'Desconectado',  color: 'text-gray-500 bg-gray-50 border-gray-200' },
  no_signal: { label: 'Sin señal',     color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  unknown:   { label: 'Desconocido',   color: 'text-gray-400 bg-gray-50 border-gray-200' },
}

const CMD_LABELS: Record<string, string> = {
  immobilize: 'Inmovilizar', enable: 'Habilitar',
  get_position: 'Ubicación', reboot: 'Reiniciar GPS',
  microphone: 'Activar micrófono',
}

const CMD_STATUS: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviado', confirmed: 'Confirmado',
  failed: 'Fallido', cancelled: 'Cancelado',
}

interface Props {
  deviceId: string
  canCommand: boolean
  mapsApiKey?: string
}

export function DeviceDetailClient({ deviceId, canCommand, mapsApiKey = '' }: Props) {
  const [device, setDevice]       = useState<DeviceDetail | null>(null)
  const [commands, setCommands]   = useState<Command[]>([])
  const [alerts, setAlerts]       = useState<VehicleAlert[]>([])
  const [loading, setLoading]     = useState(true)
  const [cmdLoading, setCmdLoading] = useState<string | null>(null)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    const [devRes, cmdRes] = await Promise.all([
      fetch(`/api/devices/${deviceId}`),
      fetch(`/api/devices/${deviceId}/commands`),
    ])
    const devData = await devRes.json()
    const cmdData = await cmdRes.json()
    setDevice(devData.data ?? null)
    setCommands(cmdData.data ?? [])

    const vehicleId = devData.data?.vehicle?.id
    if (vehicleId) {
      const alertRes = await fetch(`/api/alerts?per_page=5&vehicle_id=${vehicleId}`)
      const alertData = await alertRes.json()
      setAlerts(alertData.data ?? [])
    } else {
      setAlerts([])
    }

    setLoading(false)
  }, [deviceId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const interval = setInterval(() => void load(), 15_000)
    return () => clearInterval(interval)
  }, [load])

  async function sendCommand(type: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return
    setCmdLoading(type)
    setError('')
    try {
      const res = await fetch(`/api/devices/${deviceId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command_type: type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setCmdLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando dispositivo...
      </div>
    )
  }

  if (!device) {
    return <div className="py-24 text-center text-gray-500">Dispositivo no encontrado</div>
  }

  const status = STATUS_LABELS[device.status] ?? STATUS_LABELS['unknown']!
  const rawPos = (device.vehicle as (DeviceDetail['vehicle'] & { position?: DeviceDetail['vehicle']['position'] | DeviceDetail['vehicle']['position'][] }) | null)?.position
  const pos = Array.isArray(rawPos) ? (rawPos[0] ?? null) : (rawPos ?? null)
  const vehicle = device.vehicle
  const historyHref = vehicle
    ? pos
      ? `/history?vehicle_id=${vehicle.id}&lat=${pos.lat}&lng=${pos.lng}`
      : `/history?vehicle_id=${vehicle.id}`
    : null

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link href="/devices" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Volver a dispositivos
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{device.model}</h1>
              <p className="font-mono text-sm text-gray-500 mt-0.5">IMEI {device.imei}</p>
              {device.company && <p className="text-xs text-gray-400 mt-1">{device.company.name}</p>}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium ${status.color}`}>
            {device.status === 'online' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {status.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6 text-sm">
          <div><span className="text-gray-400 text-xs">SIM</span><div>{device.phone_num ?? '—'}</div></div>
          <div><span className="text-gray-400 text-xs">ICCID</span><div className="font-mono text-xs">{device.sim_iccid?.slice(-10) ?? '—'}</div></div>
          <div><span className="text-gray-400 text-xs">Firmware</span><div>{device.firmware_ver ?? '—'}</div></div>
          <div><span className="text-gray-400 text-xs">Última conexión</span>
            <div>{device.last_seen ? new Date(device.last_seen).toLocaleString('es-MX') : 'Nunca'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Mapa + telemetría */}
        <div className="lg:col-span-2 space-y-4 order-1">
          {pos ? (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Ubicación en tiempo real</h2>
                  <span className="text-xs text-gray-400">
                    {new Date(pos.recorded_at).toLocaleString('es-MX')}
                  </span>
                </div>
                <DeviceMap lat={pos.lat} lng={pos.lng} label={vehicle?.economic_num ?? device.imei} />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[
                  { icon: Gauge,     label: 'Velocidad',  value: `${Math.round(pos.speed)} km/h`, color: pos.speed > 80 ? 'text-red-600' : '' },
                  { icon: Zap,       label: 'Motor',      value: pos.ignition ? 'Encendido' : 'Apagado', color: pos.ignition ? 'text-green-600' : 'text-gray-400' },
                  { icon: Signal,    label: 'GSM',        value: `${pos.gsm_signal}%` },
                  { icon: Satellite, label: 'Satélites',  value: String(pos.satellites ?? '—') },
                  { icon: Battery,   label: 'Batería',    value: `${pos.battery_lvl}%` },
                  { icon: MapPin,    label: 'Odómetro',   value: `${(pos.odometer / 1000).toFixed(1)} km` },
                  { icon: Clock,     label: 'Rumbo',      value: `${Math.round(pos.heading)}°` },
                  { icon: MapPin,    label: 'Coords',     value: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Icon className="w-3.5 h-3.5" />{label}
                    </div>
                    <div className={`text-lg font-semibold text-gray-900 ${color ?? ''}`}>{value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Sin posición GPS disponible</p>
              {device.status !== 'online' && (
                <p className="text-xs mt-2">El dispositivo debe estar en línea y asignado a un vehículo</p>
              )}
            </div>
          )}

          {vehicle && mapsApiKey && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Recorrido del día</h2>
                <Link href={historyHref!}
                  className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                  <History className="w-3.5 h-3.5" /> Historial completo
                </Link>
              </div>
              <div className="p-4">
                <RoutePlayback
                  vehicleId={vehicle.id}
                  vehicleName={`${vehicle.economic_num} (${vehicle.plates})`}
                  apiKey={mapsApiKey}
                  compact
                  autoLoadToday
                />
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-4 order-2">
          {/* Vehículo y cliente */}
          {vehicle ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Asignación</h2>
              <div className="flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-gray-400" />
                <Link href={historyHref!}
                  className="text-orange-500 hover:underline font-medium">
                  {vehicle.economic_num} ({vehicle.plates})
                </Link>
              </div>
              <div className="text-xs text-gray-500">{vehicle.brand} {vehicle.model}</div>
              {vehicle.driver && (
                <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-100">
                  <User className="w-4 h-4 text-gray-400" />
                  <Link href={`/drivers/${vehicle.driver.id}`} className="text-orange-500 hover:underline">
                    {vehicle.driver.full_name}
                  </Link>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {historyHref && (
                <Link href={historyHref}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-orange-500 border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <History className="w-3.5 h-3.5" /> Historial
                </Link>
                )}
                <Link href={`/alerts?vehicle_id=${vehicle.id}`}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-orange-500 border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <Bell className="w-3.5 h-3.5" /> Alertas
                </Link>
              </div>

              {alerts.length > 0 && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-medium text-gray-500">Alertas recientes</p>
                  {alerts.slice(0, 3).map(a => (
                    <div key={a.id} className="text-xs border border-gray-100 rounded-lg px-2.5 py-2">
                      <div className="font-medium text-gray-800 truncate">{a.title}</div>
                      <div className="text-gray-400 mt-0.5">
                        {new Date(a.created_at).toLocaleString('es-MX')}
                        {!a.acknowledged_at && <span className="text-orange-500 ml-1">· Sin atender</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Sin vehículo asignado — asigna este GPS a un vehículo para ver posiciones.
            </div>
          )}

          {/* Comandos remotos */}
          {canCommand && (
            <details className="bg-white border border-gray-200 rounded-2xl group" open>
              <summary className="p-4 sm:p-5 cursor-pointer list-none flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Control remoto</h2>
                <span className="text-xs text-gray-400 lg:hidden">Tocar para expandir</span>
              </summary>
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-2">
              <p className="text-xs text-gray-400 mb-4">
                Inmovilizador: requiere relé cableado (Teltonika). Micrófono: requiere mic externo y número autorizado en el GPS.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <button
                  disabled={!!cmdLoading || device.status !== 'online'}
                  onClick={() => sendCommand('immobilize', '¿Inmovilizar vehículo? Se cortará el arranque.')}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-40 transition"
                >
                  {cmdLoading === 'immobilize' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Inmovilizar (apagar arranque)
                </button>
                <button
                  disabled={!!cmdLoading || device.status !== 'online'}
                  onClick={() => sendCommand('enable', '¿Habilitar arranque del vehículo?')}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-40 transition"
                >
                  {cmdLoading === 'enable' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Habilitar arranque
                </button>
                <button
                  disabled={!!cmdLoading || device.status !== 'online'}
                  onClick={() => sendCommand('get_position', '¿Solicitar ubicación actual al GPS?')}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 disabled:opacity-40 transition"
                >
                  {cmdLoading === 'get_position' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Solicitar ubicación
                </button>
                <button
                  disabled={!!cmdLoading || device.status !== 'online'}
                  onClick={() => sendCommand('reboot', '¿Reiniciar el dispositivo GPS?')}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  {cmdLoading === 'reboot' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reiniciar GPS
                </button>
                <button
                  disabled={!!cmdLoading || device.status !== 'online'}
                  onClick={() => sendCommand(
                    'microphone',
                    '¿Activar micrófono? El GPS llamará al número autorizado configurado en el dispositivo para escucha remota.'
                  )}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-40 transition"
                >
                  {cmdLoading === 'microphone' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                  Activar micrófono
                </button>
              </div>

              {device.status !== 'online' && (
                <p className="text-xs text-orange-600 mt-3">
                  Dispositivo sin conexión TCP — los comandos quedan en cola hasta que se conecte.
                </p>
              )}
            </div>
            </details>
          )}

          {/* Historial de comandos */}
          <details className="bg-white border border-gray-200 rounded-2xl group">
            <summary className="p-4 sm:p-5 cursor-pointer list-none">
              <h2 className="text-sm font-semibold text-gray-900 inline">Comandos enviados</h2>
              {commands.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">({commands.length})</span>
              )}
            </summary>
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-2">
            {commands.length === 0 ? (
              <p className="text-xs text-gray-400">Sin comandos aún</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {commands.map(cmd => (
                  <div key={cmd.id} className="text-xs border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex justify-between font-medium text-gray-800">
                      <span>{CMD_LABELS[cmd.command_type] ?? cmd.command_type}</span>
                      <span className={
                        cmd.status === 'confirmed' ? 'text-green-600' :
                        cmd.status === 'failed' ? 'text-red-600' : 'text-gray-400'
                      }>{CMD_STATUS[cmd.status] ?? cmd.status}</span>
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {new Date(cmd.created_at).toLocaleString('es-MX')}
                      {cmd.issued_by_user && ` · ${cmd.issued_by_user.full_name}`}
                    </div>
                    {cmd.error_msg && <div className="text-red-500 mt-0.5">{cmd.error_msg}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          </details>
        </div>
      </div>
    </div>
  )
}
