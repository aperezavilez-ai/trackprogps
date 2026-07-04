'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, Radio, Wifi, WifiOff, MapPin, Gauge, Zap, Battery,
  Signal, Satellite, Clock, Lock, Unlock, RefreshCw, RotateCcw,
  Loader2, AlertTriangle, User, Truck, History, Bell, Mic, Phone, Mail,
  Smartphone, type LucideIcon,
} from 'lucide-react'
import { PanicButton } from '@/components/mobile/panic-button'

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
  source_type?: string
  mobile_platform?: 'android' | 'ios' | null
  tracking_enabled?: boolean
  tracking_interval_sec?: number | null
  mobile_metadata?: Record<string, unknown> | null
  protocol_metadata?: Record<string, unknown> | null
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
      battery_lvl: number; satellites: number | null; raw_io?: Record<string, unknown> | null; recorded_at: string
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

type PersonInfo = {
  name?: string
  phone?: string
  email?: string
  address?: string
  relationship?: string
}

type ContactInfo = {
  owner?: PersonInfo
  responsible?: PersonInfo
  emergency?: PersonInfo
}

type ContactDraft = {
  owner_name: string
  owner_phone: string
  owner_email: string
  owner_address: string
  responsible_name: string
  responsible_phone: string
  responsible_email: string
  emergency_name: string
  emergency_phone: string
  emergency_email: string
  emergency_relationship: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  online: { label: 'En linea', color: 'text-green-600 bg-green-50 border-green-200' },
  offline: { label: 'Desconectado', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  no_signal: { label: 'Sin senal', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  unknown: { label: 'Desconocido', color: 'text-gray-400 bg-gray-50 border-gray-200' },
  pending_mobile: { label: 'Pendiente app', color: 'text-teal-700 bg-teal-50 border-teal-200' },
  mobile_paused: { label: 'Rastreo pausado', color: 'text-red-700 bg-red-50 border-red-200' },
}

const CMD_LABELS: Record<string, string> = {
  immobilize: 'Inmovilizar',
  enable: 'Habilitar',
  get_position: 'Ubicacion',
  reboot: 'Reiniciar GPS',
  microphone: 'Activar microfono',
}

const CMD_STATUS: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  confirmed: 'Confirmado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
}

interface Props {
  deviceId: string
  canCommand: boolean
  mapsApiKey?: string
}

export function DeviceDetailClient({ deviceId, canCommand, mapsApiKey = '' }: Props) {
  const [device, setDevice] = useState<DeviceDetail | null>(null)
  const [commands, setCommands] = useState<Command[]>([])
  const [alerts, setAlerts] = useState<VehicleAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [cmdLoading, setCmdLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editingContacts, setEditingContacts] = useState(false)
  const [savingContacts, setSavingContacts] = useState(false)
  const [refreshingLocation, setRefreshingLocation] = useState(false)
  const [contactDraft, setContactDraft] = useState<ContactDraft>(() => emptyContactDraft())

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
    if (!device || editingContacts) return
    setContactDraft(buildContactDraft(device))
  }, [device, editingContacts])

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

  async function saveContacts() {
    const ownerName = contactDraft.owner_name.trim()
    const ownerPhone = contactDraft.owner_phone.trim()
    const responsibleName = contactDraft.responsible_name.trim()
    const responsiblePhone = contactDraft.responsible_phone.trim()
    const emergencyName = contactDraft.emergency_name.trim()
    const emergencyPhone = contactDraft.emergency_phone.trim()

    if (!ownerName || !ownerPhone || !responsibleName || !responsiblePhone || !emergencyName || !emergencyPhone) {
      setError('Propietario, responsable y emergencia requieren nombre y celular')
      return
    }

    setSavingContacts(true)
    setError('')
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_owner: {
            name: ownerName,
            phone: ownerPhone,
            email: contactDraft.owner_email.trim() || null,
            address: contactDraft.owner_address.trim() || null,
          },
          responsible_contact: {
            name: responsibleName,
            phone: responsiblePhone,
            email: contactDraft.responsible_email.trim() || null,
          },
          emergency_contacts: [{
            name: emergencyName,
            phone: emergencyPhone,
            email: contactDraft.emergency_email.trim() || null,
            relationship: contactDraft.emergency_relationship.trim() || null,
            priority: 1,
          }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setEditingContacts(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSavingContacts(false)
    }
  }

  async function refreshMobileLocation() {
    if (!device || device.source_type !== 'mobile') return
    if (!('geolocation' in navigator)) {
      setError('Este navegador no soporta ubicacion GPS')
      return
    }

    setRefreshingLocation(true)
    setError('')
    try {
      const position = await getCurrentBrowserPosition()
      const battery = await getBrowserBattery()
      const res = await fetch('/api/mobile/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.id,
          points: [{
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed ?? 0,
            heading: position.coords.heading ?? 0,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            recorded_at: new Date(position.timestamp).toISOString(),
            battery_pct: battery?.pct ?? null,
            battery_charging: battery?.charging ?? null,
            connection_type: getConnectionType(),
            gps_enabled: true,
            internet_available: navigator.onLine,
            is_moving: (position.coords.speed ?? 0) > 0.7,
            activity: 'unknown',
            mock_location: false,
          }],
        }),
      })
      const data = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo actualizar la ubicacion')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo obtener ubicacion del telefono')
    } finally {
      setRefreshingLocation(false)
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

  const isMobile = device.source_type === 'mobile'
  const metadata = isMobile ? device.mobile_metadata : device.protocol_metadata
  const manuallyPaused = isMobile && isManualTrackingPaused(metadata)
  const effectiveStatus = isMobile
    ? manuallyPaused
      ? 'mobile_paused'
      : device.last_seen
        ? 'online'
        : 'pending_mobile'
    : device.status
  const status = STATUS_LABELS[effectiveStatus] ?? STATUS_LABELS['unknown']!
  type VehiclePosition = NonNullable<DeviceDetail['vehicle']>['position']
  const rawPos = device.vehicle?.position as VehiclePosition | VehiclePosition[] | null | undefined
  const pos = Array.isArray(rawPos) ? (rawPos[0] ?? null) : (rawPos ?? null)
  const vehicle = device.vehicle
  const contactInfo = getDeviceContactInfo(device)
  const mobileName = contactInfo.owner?.name || readMetadataString(metadata, 'model') || device.model
  const headerTitle = isMobile ? mobileName : device.model
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

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isMobile ? 'bg-teal-50' : 'bg-orange-50'}`}>
              {isMobile
                ? <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                : <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{headerTitle}</h1>
              <p className="font-mono text-sm text-gray-500 mt-0.5">IMEI {device.imei}</p>
              {isMobile && <p className="text-xs text-teal-600 mt-1">Dispositivo movil / rastreo por telefono</p>}
              {device.company && <p className="text-xs text-gray-400 mt-1">{device.company.name}</p>}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium ${status.color}`}>
            {effectiveStatus === 'online' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {status.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6 text-sm">
          <HeaderField label={isMobile ? 'Telefono SIM' : 'SIM'} value={device.phone_num} />
          <HeaderField label="ICCID" value={device.sim_iccid?.slice(-10)} mono />
          <HeaderField label="Firmware" value={device.firmware_ver} />
          <HeaderField label="Ultima conexion" value={device.last_seen ? new Date(device.last_seen).toLocaleString('es-MX') : 'Nunca'} />
          {isMobile && (
            <>
              <HeaderField label="Plataforma" value={formatMobilePlatform(device.mobile_platform, readMetadataString(metadata, 'os_version'))} />
              <HeaderField label="Equipo" value={[readMetadataString(metadata, 'brand'), readMetadataString(metadata, 'model')].filter(Boolean).join(' ') || device.model} />
              <HeaderField label="Version app" value={readMetadataString(metadata, 'app_version') || inferMobileAppVersion(metadata)} />
              <HeaderField label="Intervalo" value={`${device.tracking_interval_sec ?? 30} seg`} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 order-1">
          {pos ? (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Ubicacion en tiempo real</h2>
                    <span className="text-xs text-gray-400">
                      {new Date(pos.recorded_at).toLocaleString('es-MX')}
                    </span>
                  </div>
                  {isMobile && (
                    <button
                      type="button"
                      disabled={refreshingLocation}
                      onClick={() => void refreshMobileLocation()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      {refreshingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Actualizar
                    </button>
                  )}
                </div>
                <DeviceMap
                  lat={pos.lat}
                  lng={pos.lng}
                  label={isMobile ? mobileName : (vehicle?.economic_num ?? device.imei)}
                  deviceSource={isMobile ? 'mobile' : 'hardware'}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {buildTelemetryCards(pos, isMobile).map(({ icon: Icon, label, value, color }) => (
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
              <p>Sin posicion GPS disponible</p>
              {effectiveStatus !== 'online' && (
                <p className="text-xs mt-2">
                  {isMobile ? 'El movil debe enviar su primera ubicacion desde la app.' : 'El dispositivo debe estar en linea y asignado a un vehiculo'}
                </p>
              )}
            </div>
          )}

          {vehicle && mapsApiKey && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Recorrido del dia</h2>
                {historyHref && (
                  <Link href={historyHref} className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                    <History className="w-3.5 h-3.5" /> Historial completo
                  </Link>
                )}
              </div>
              <div className="p-4">
                <RoutePlayback
                  vehicleId={vehicle.id}
                  vehicleName={isMobile ? mobileName : `${vehicle.economic_num} (${vehicle.plates})`}
                  deviceSource={isMobile ? 'mobile' : 'hardware'}
                  apiKey={mapsApiKey}
                  compact
                  autoLoadToday
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 order-2">
          {isMobile ? (
            <MobileAssignmentCard
              device={device}
              metadata={metadata}
              name={mobileName}
              historyHref={historyHref}
              vehicleId={vehicle?.id}
              alerts={alerts}
            />
          ) : vehicle ? (
            <VehicleAssignmentCard vehicle={vehicle} historyHref={historyHref} alerts={alerts} />
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Sin vehiculo asignado. Asigna este GPS a un vehiculo para ver posiciones.
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">Propietario, responsable y emergencia</h2>
              {canCommand && (
                <button
                  type="button"
                  onClick={() => setEditingContacts(prev => !prev)}
                  className={`text-xs font-medium ${isMobile ? 'text-teal-600 hover:text-teal-700' : 'text-orange-500 hover:text-orange-600'}`}
                >
                  {editingContacts ? 'Cancelar' : contactInfo.owner || contactInfo.responsible || contactInfo.emergency ? 'Editar' : 'Agregar'}
                </button>
              )}
            </div>

            {editingContacts ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <ContactInput label="Propietario *" value={contactDraft.owner_name} onChange={value => setContactDraft(prev => ({ ...prev, owner_name: value }))} />
                  <ContactInput label="Telefono propietario *" value={contactDraft.owner_phone} onChange={value => setContactDraft(prev => ({ ...prev, owner_phone: value }))} />
                  <ContactInput label="Correo propietario" value={contactDraft.owner_email} onChange={value => setContactDraft(prev => ({ ...prev, owner_email: value }))} type="email" />
                  <ContactInput label="Direccion propietario" value={contactDraft.owner_address} onChange={value => setContactDraft(prev => ({ ...prev, owner_address: value }))} />
                </div>
                <div className="grid gap-2 pt-3 border-t border-gray-100">
                  <ContactInput label="Responsable *" value={contactDraft.responsible_name} onChange={value => setContactDraft(prev => ({ ...prev, responsible_name: value }))} />
                  <ContactInput label="Celular responsable *" value={contactDraft.responsible_phone} onChange={value => setContactDraft(prev => ({ ...prev, responsible_phone: value }))} />
                  <ContactInput label="Correo responsable" value={contactDraft.responsible_email} onChange={value => setContactDraft(prev => ({ ...prev, responsible_email: value }))} type="email" />
                </div>
                <div className="grid gap-2 pt-3 border-t border-gray-100">
                  <ContactInput label="Contacto emergencia *" value={contactDraft.emergency_name} onChange={value => setContactDraft(prev => ({ ...prev, emergency_name: value }))} />
                  <ContactInput label="Celular emergencia *" value={contactDraft.emergency_phone} onChange={value => setContactDraft(prev => ({ ...prev, emergency_phone: value }))} />
                  <ContactInput label="Correo emergencia" value={contactDraft.emergency_email} onChange={value => setContactDraft(prev => ({ ...prev, emergency_email: value }))} type="email" />
                  <ContactInput label="Relacion" value={contactDraft.emergency_relationship} onChange={value => setContactDraft(prev => ({ ...prev, emergency_relationship: value }))} />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}
                <button
                  type="button"
                  disabled={savingContacts}
                  onClick={() => void saveContacts()}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 ${isMobile ? 'bg-teal-600 hover:bg-teal-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                >
                  {savingContacts ? 'Guardando...' : 'Guardar datos'}
                </button>
              </div>
            ) : contactInfo.owner || contactInfo.responsible || contactInfo.emergency ? (
              <ContactReadout contactInfo={contactInfo} />
            ) : (
              <p className="text-sm text-gray-400">Sin datos registrados para alertas de panico.</p>
            )}
          </div>

          {isMobile && (
            <div className="bg-white border border-red-100 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Boton de panico del movil</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Envia SOS usando la ultima ubicacion registrada del dispositivo.
                  </p>
                </div>
                <PanicButton
                  deviceId={device.id}
                  lat={pos?.lat ?? null}
                  lng={pos?.lng ?? null}
                  deviceName={mobileName}
                  contactSummary={buildPanicContactSummary(contactInfo)}
                  className="h-10 bg-red-600"
                />
              </div>
              <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {buildPanicContactSummary(contactInfo) || 'Sin contactos registrados: agrega propietario/responsable/emergencia antes de operar.'}
              </div>
            </div>
          )}

          {canCommand && !isMobile && (
            <details className="bg-white border border-gray-200 rounded-2xl group" open>
              <summary className="p-4 sm:p-5 cursor-pointer list-none flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Control remoto</h2>
                <span className="text-xs text-gray-400 lg:hidden">Tocar para expandir</span>
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-2">
                <p className="text-xs text-gray-400 mb-4">
                  Inmovilizador: requiere rele cableado. Microfono: requiere mic externo y numero autorizado en el GPS.
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <CommandButton loading={cmdLoading === 'immobilize'} disabled={!!cmdLoading || device.status !== 'online'} icon={Lock} label="Inmovilizar (apagar arranque)" tone="red" onClick={() => sendCommand('immobilize', 'Inmovilizar vehiculo? Se cortara el arranque.')} />
                  <CommandButton loading={cmdLoading === 'enable'} disabled={!!cmdLoading || device.status !== 'online'} icon={Unlock} label="Habilitar arranque" tone="green" onClick={() => sendCommand('enable', 'Habilitar arranque del vehiculo?')} />
                  <CommandButton loading={cmdLoading === 'get_position'} disabled={!!cmdLoading || device.status !== 'online'} icon={RefreshCw} label="Solicitar ubicacion" tone="orange" onClick={() => sendCommand('get_position', 'Solicitar ubicacion actual al GPS?')} />
                  <CommandButton loading={cmdLoading === 'reboot'} disabled={!!cmdLoading || device.status !== 'online'} icon={RotateCcw} label="Reiniciar GPS" tone="gray" onClick={() => sendCommand('reboot', 'Reiniciar el dispositivo GPS?')} />
                  <CommandButton loading={cmdLoading === 'microphone'} disabled={!!cmdLoading || device.status !== 'online'} icon={Mic} label="Activar microfono" tone="purple" onClick={() => sendCommand('microphone', 'Activar microfono? El GPS llamara al numero autorizado configurado.')} />
                </div>

                {effectiveStatus !== 'online' && (
                  <p className="text-xs text-orange-600 mt-3">
                    Dispositivo sin conexion TCP. Los comandos quedan en cola hasta que se conecte.
                  </p>
                )}
              </div>
            </details>
          )}

          {!isMobile && (
            <details className="bg-white border border-gray-200 rounded-2xl group">
              <summary className="p-4 sm:p-5 cursor-pointer list-none">
                <h2 className="text-sm font-semibold text-gray-900 inline">Comandos enviados</h2>
                {commands.length > 0 && <span className="ml-2 text-xs text-gray-400">({commands.length})</span>}
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-2">
                {commands.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin comandos aun</p>
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
                          {cmd.issued_by_user && ` - ${cmd.issued_by_user.full_name}`}
                        </div>
                        {cmd.error_msg && <div className="text-red-500 mt-0.5">{cmd.error_msg}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

function buildTelemetryCards(pos: NonNullable<NonNullable<DeviceDetail['vehicle']>['position']>, isMobile: boolean) {
  const mobileBattery = readMobileBatteryLabel(pos)
  return [
    { icon: Gauge, label: 'Velocidad', value: `${Math.round(pos.speed)} km/h`, color: pos.speed > 80 ? 'text-red-600' : '' },
    {
      icon: Zap,
      label: isMobile ? 'Movimiento' : 'Motor',
      value: isMobile ? (pos.speed > 1 ? 'En movimiento' : 'Detenido') : (pos.ignition ? 'Encendido' : 'Apagado'),
      color: isMobile ? (pos.speed > 1 ? 'text-green-600' : 'text-gray-400') : (pos.ignition ? 'text-green-600' : 'text-gray-400'),
    },
    { icon: Signal, label: isMobile ? 'Senal movil' : 'GSM', value: `${pos.gsm_signal}%` },
    { icon: Satellite, label: 'Satelites', value: String(pos.satellites ?? '-') },
    { icon: Battery, label: isMobile ? 'Bateria movil' : 'Bateria', value: isMobile ? mobileBattery : `${pos.battery_lvl}%`, color: isMobile && mobileBattery === 'No disponible' ? 'text-gray-400' : '' },
    { icon: MapPin, label: isMobile ? 'Trayecto' : 'Odometro', value: `${(pos.odometer / 1000).toFixed(1)} km` },
    { icon: Clock, label: 'Rumbo', value: `${Math.round(pos.heading)} deg` },
    { icon: MapPin, label: 'Coords', value: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` },
  ]
}

function MobileAssignmentCard({
  device,
  metadata,
  name,
  historyHref,
  vehicleId,
  alerts,
}: {
  device: DeviceDetail
  metadata: Record<string, unknown> | null | undefined
  name: string
  historyHref: string | null
  vehicleId?: string
  alerts: VehicleAlert[]
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Persona y movil</h2>
      <div className="flex items-center gap-2 text-sm">
        <Smartphone className="w-4 h-4 text-teal-600" />
        <span className="font-medium text-gray-900">{name}</span>
      </div>
      <div className="grid gap-2 text-xs text-gray-500">
        <InfoLine label="Telefono SIM" value={device.phone_num} />
        <InfoLine label="ICCID" value={device.sim_iccid} mono />
        <InfoLine label="IMEI" value={device.imei} mono />
        <InfoLine label="Marca" value={readMetadataString(metadata, 'brand')} />
        <InfoLine label="Modelo" value={readMetadataString(metadata, 'model') || device.model} />
        <InfoLine label="Notas" value={readMetadataString(metadata, 'device_notes')} />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {historyHref && (
          <Link href={historyHref} className="flex items-center gap-1 text-xs text-gray-600 hover:text-teal-600 border border-gray-200 rounded-lg px-2.5 py-1.5">
            <History className="w-3.5 h-3.5" /> Historial
          </Link>
        )}
        {vehicleId && (
          <Link href={`/alerts?vehicle_id=${vehicleId}`} className="flex items-center gap-1 text-xs text-gray-600 hover:text-teal-600 border border-gray-200 rounded-lg px-2.5 py-1.5">
            <Bell className="w-3.5 h-3.5" /> Alertas
          </Link>
        )}
      </div>
      {alerts.length > 0 && <RecentAlerts alerts={alerts} />}
    </div>
  )
}

function VehicleAssignmentCard({
  vehicle,
  historyHref,
  alerts,
}: {
  vehicle: NonNullable<DeviceDetail['vehicle']>
  historyHref: string | null
  alerts: VehicleAlert[]
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Asignacion</h2>
      <div className="flex items-center gap-2 text-sm">
        <Truck className="w-4 h-4 text-gray-400" />
        <Link href={historyHref ?? `/history?vehicle_id=${vehicle.id}`} className="text-orange-500 hover:underline font-medium">
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
          <Link href={historyHref} className="flex items-center gap-1 text-xs text-gray-600 hover:text-orange-500 border border-gray-200 rounded-lg px-2.5 py-1.5">
            <History className="w-3.5 h-3.5" /> Historial
          </Link>
        )}
        <Link href={`/alerts?vehicle_id=${vehicle.id}`} className="flex items-center gap-1 text-xs text-gray-600 hover:text-orange-500 border border-gray-200 rounded-lg px-2.5 py-1.5">
          <Bell className="w-3.5 h-3.5" /> Alertas
        </Link>
      </div>
      {alerts.length > 0 && <RecentAlerts alerts={alerts} />}
    </div>
  )
}

function RecentAlerts({ alerts }: { alerts: VehicleAlert[] }) {
  return (
    <div className="pt-3 border-t border-gray-100 space-y-2">
      <p className="text-xs font-medium text-gray-500">Alertas recientes</p>
      {alerts.slice(0, 3).map(a => (
        <div key={a.id} className="text-xs border border-gray-100 rounded-lg px-2.5 py-2">
          <div className="font-medium text-gray-800 truncate">{a.title}</div>
          <div className="text-gray-400 mt-0.5">
            {new Date(a.created_at).toLocaleString('es-MX')}
            {!a.acknowledged_at && <span className="text-orange-500 ml-1">- Sin atender</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function ContactReadout({ contactInfo }: { contactInfo: ContactInfo }) {
  return (
    <>
      {contactInfo.owner && (
        <PersonBlock title="Propietario" person={contactInfo.owner} />
      )}
      {contactInfo.responsible && (
        <PersonBlock title="Responsable operativo" person={contactInfo.responsible} />
      )}
      {contactInfo.emergency && (
        <PersonBlock title={contactInfo.emergency.relationship || 'Contacto de emergencia'} person={contactInfo.emergency} emergency />
      )}
    </>
  )
}

function buildPanicContactSummary(contactInfo: ContactInfo) {
  return [
    contactInfo.owner?.name ? `Propietario: ${contactInfo.owner.name}${contactInfo.owner.phone ? ` (${contactInfo.owner.phone})` : ''}` : '',
    contactInfo.responsible?.name ? `Responsable: ${contactInfo.responsible.name}${contactInfo.responsible.phone ? ` (${contactInfo.responsible.phone})` : ''}` : '',
    contactInfo.emergency?.name ? `Emergencia: ${contactInfo.emergency.name}${contactInfo.emergency.phone ? ` (${contactInfo.emergency.phone})` : ''}` : '',
  ].filter(Boolean).join(' | ')
}

function PersonBlock({ title, person, emergency = false }: { title: string; person: PersonInfo; emergency?: boolean }) {
  return (
    <div className="space-y-1 text-sm pt-3 first:pt-0 border-t first:border-t-0 border-gray-100">
      <div className={`flex items-center gap-2 font-medium ${emergency ? 'text-red-700' : 'text-gray-900'}`}>
        {emergency ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <User className="w-4 h-4 text-gray-400" />}
        {person.name ?? title}
      </div>
      <div className="text-xs text-gray-400 pl-6">{title}</div>
      {person.phone && <ContactDetail icon="phone" value={person.phone} />}
      {person.email && <ContactDetail icon="mail" value={person.email} />}
      {person.address && <ContactDetail icon="map" value={person.address} />}
    </div>
  )
}

function ContactDetail({ icon, value }: { icon: 'phone' | 'mail' | 'map'; value: string }) {
  const Icon = icon === 'phone' ? Phone : icon === 'mail' ? Mail : MapPin
  return (
    <div className="flex items-center gap-2 text-gray-500 break-all">
      <Icon className="w-4 h-4 text-gray-300 flex-shrink-0" />
      {value}
    </div>
  )
}

function HeaderField({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <div className={mono ? 'font-mono text-xs' : ''}>{value || '-'}</div>
    </div>
  )
}

function InfoLine({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-400">{label}</span>
      <span className={`text-right text-gray-700 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function CommandButton({
  loading,
  disabled,
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  loading: boolean
  disabled: boolean
  icon: LucideIcon
  label: string
  tone: 'red' | 'green' | 'orange' | 'gray' | 'purple'
  onClick: () => void
}) {
  const toneClasses = {
    red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  }[tone]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border disabled:opacity-40 transition ${toneClasses}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  )
}

function getDeviceContactInfo(device: DeviceDetail): ContactInfo {
  const metadata = device.source_type === 'mobile' ? device.mobile_metadata : device.protocol_metadata
  if (!metadata || typeof metadata !== 'object') return {}

  const owner = readContactObject(metadata.device_owner)
  const responsible = readContactObject(metadata.responsible_contact)
  const emergencyContacts = metadata.emergency_contacts
  const firstEmergency = Array.isArray(emergencyContacts) ? readContactObject(emergencyContacts[0]) : undefined

  return { owner, responsible, emergency: firstEmergency }
}

function buildContactDraft(device: DeviceDetail): ContactDraft {
  const contact = getDeviceContactInfo(device)
  return {
    owner_name: contact.owner?.name ?? '',
    owner_phone: contact.owner?.phone ?? '',
    owner_email: contact.owner?.email ?? '',
    owner_address: contact.owner?.address ?? '',
    responsible_name: contact.responsible?.name ?? '',
    responsible_phone: contact.responsible?.phone ?? '',
    responsible_email: contact.responsible?.email ?? '',
    emergency_name: contact.emergency?.name ?? '',
    emergency_phone: contact.emergency?.phone ?? '',
    emergency_email: contact.emergency?.email ?? '',
    emergency_relationship: contact.emergency?.relationship ?? 'Contacto de emergencia',
  }
}

function emptyContactDraft(): ContactDraft {
  return {
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    owner_address: '',
    responsible_name: '',
    responsible_phone: '',
    responsible_email: '',
    emergency_name: '',
    emergency_phone: '',
    emergency_email: '',
    emergency_relationship: 'Contacto de emergencia',
  }
}

function readContactObject(value: unknown): PersonInfo | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const contact = value as Record<string, unknown>
  return {
    name: typeof contact.name === 'string' ? contact.name : undefined,
    phone: typeof contact.phone === 'string' ? contact.phone : undefined,
    email: typeof contact.email === 'string' ? contact.email : undefined,
    address: typeof contact.address === 'string' ? contact.address : undefined,
    relationship: typeof contact.relationship === 'string' ? contact.relationship : undefined,
  }
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function isManualTrackingPaused(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const reason = metadata.tracking_disabled_reason
  return typeof reason === 'string' && reason.startsWith('manual_')
}

function formatMobilePlatform(platform: DeviceDetail['mobile_platform'], osVersion: string): string {
  if (osVersion) {
    if (platform === 'ios' && !/^ios\b/i.test(osVersion)) return `iOS ${osVersion}`
    if (platform === 'android' && !/^android\b/i.test(osVersion)) return `Android ${osVersion}`
    return osVersion
  }
  if (platform === 'ios') return 'iOS'
  if (platform === 'android') return 'Android'
  return 'No registrada'
}

function inferMobileAppVersion(metadata: Record<string, unknown> | null | undefined): string {
  const source = readMetadataString(metadata, 'source')
  if (source === 'browser_pwa') return 'web-pwa'
  return 'No registrada'
}

function readMobileBatteryLabel(pos: NonNullable<NonNullable<DeviceDetail['vehicle']>['position']>): string {
  const rawBattery = pos.raw_io && typeof pos.raw_io === 'object'
    ? (pos.raw_io as Record<string, unknown>).battery_pct
    : undefined
  if (typeof rawBattery === 'number') return `${Math.round(rawBattery)}%`
  if (pos.battery_lvl > 0) return `${pos.battery_lvl}%`
  return 'No disponible'
}

function getCurrentBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    })
  })
}

async function getBrowserBattery(): Promise<{ pct: number; charging: boolean | null } | null> {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ level?: number; charging?: boolean }>
  }
  if (typeof nav.getBattery !== 'function') return null
  try {
    const battery = await nav.getBattery()
    if (typeof battery.level !== 'number') return null
    return {
      pct: Math.max(0, Math.min(100, Math.round(battery.level * 100))),
      charging: typeof battery.charging === 'boolean' ? battery.charging : null,
    }
  } catch {
    return null
  }
}

function getConnectionType(): string | null {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string }
  }).connection
  return connection?.type ?? connection?.effectiveType ?? null
}

function ContactInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-gray-500">
      {label}
      <input
        value={value}
        type={type}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </label>
  )
}
