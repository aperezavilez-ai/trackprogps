'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Radio, Wifi, WifiOff, Plus, RefreshCw, Loader2, X, Smartphone, Trash2,
  Server, ClipboardList, Cpu, ShieldCheck, User, Phone, Mail,
  CreditCard, CalendarDays, Pencil,
} from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'
import { MobilePermissionSetup } from '@/components/mobile/mobile-permission-setup'

interface Device {
  id: string; imei: string; model: string; firmware_ver: string | null
  sim_iccid: string | null; phone_num: string | null; status: string; last_seen: string | null
  tracking_enabled?: boolean
  source_type?: string
  mobile_metadata?: Record<string, unknown> | null
  protocol_metadata?: Record<string, unknown> | null
  sim_recharges?: SimRecharge[]
  vehicle: { economic_num: string; plates: string } | null
}

interface SimRecharge {
  id: string
  carrier: string
  phone_num: string | null
  amount: number | string | null
  currency: string
  recharge_date: string
  validity_days: number
  next_recharge_date: string
  alert_days_before: number
  notes: string | null
  created_at: string
}

interface CompanyOption {
  id: string
  name: string
  account_type: string
}

interface UserOption {
  id: string
  full_name: string
  email: string
  role: string
}

type ContactForm = {
  responsible_name: string
  responsible_email: string
  responsible_phone: string
  emergency_name: string
  emergency_phone: string
  emergency_email: string
  emergency_relationship: string
}

type DeviceOwnerForm = {
  name: string
  phone: string
  email: string
  address: string
}

type DeviceSetupMode = 'hardware' | 'mobile'

type ContactSummary = {
  responsible?: string
  emergency?: string
}

type SimRechargeForm = {
  enabled: boolean
  carrier: string
  amount: string
  recharge_date: string
  validity_days: string
  alert_days_before: string
  notes: string
}

type DeviceSetupProfile = {
  id: string
  label: string
  manufacturer: string
  protocol: string
  transport: 'tcp' | 'udp' | 'http'
  defaultPort: string
  defaultModel: string
  models: string[]
  summary: string
  commands: (input: {
    host: string
    port: string
    apn: string
    apnUser: string
    apnPass: string
    reportIntervalSec: string
  }) => string[]
}

const TRACKPRO_GPS_HOST = 'trackpro-gps-server.fly.dev'
const TRACKPRO_GPS_PORT = '5000'
const CARRIER_OPTIONS = ['Telcel', 'AT&T', 'Movistar', 'Bait / Altan', 'Unefon', 'Pillofon', 'Otra']

const DEVICE_SETUP_PROFILES: DeviceSetupProfile[] = [
  {
    id: 'teltonika-codec8',
    label: 'Teltonika FMB / FMC / FMM',
    manufacturer: 'Teltonika',
    protocol: 'Codec 8/8E',
    transport: 'tcp',
    defaultPort: TRACKPRO_GPS_PORT,
    defaultModel: 'FMC920',
    models: ['FMC920', 'FMB920', 'FMB120', 'FMB130', 'FMC130', 'FMM920', 'FMM130', 'FMB640', 'FMC640', 'Otro'],
    summary: 'Soporte completo: posicion, ignicion, eventos, comandos y telemetria TCP.',
    commands: ({ host, port, apn, apnUser, apnPass, reportIntervalSec }) => [
      `APN: ${apn || 'apn.operador'}${apnUser ? ` / ${apnUser}` : ''}${apnPass ? ` / ${apnPass}` : ''}`,
      `Servidor: ${host}, puerto ${port}, TCP`,
      `Periodo sugerido: ${reportIntervalSec || '30'} segundos`,
    ],
  },
  {
    id: 'protrack-gt06',
    label: 'Protrack / Concox GT06',
    manufacturer: 'Protrack / Concox',
    protocol: 'GT06',
    transport: 'tcp',
    defaultPort: TRACKPRO_GPS_PORT,
    defaultModel: 'GT06N',
    models: ['GT06', 'GT06N', 'GT06E', 'GT710', 'GT800', 'JM-VL03', 'Otro'],
    summary: 'Alta para equipos economicos que se configuran por SMS con APN, IP/dominio y puerto.',
    commands: ({ host, port, apn, apnUser, apnPass, reportIntervalSec }) => [
      `APN,${apn || 'apn.operador'}${apnUser ? `,${apnUser}` : ''}${apnPass ? `,${apnPass}` : ''}#`,
      `SERVER,1,${host},${port},0#`,
      `TIMER,${reportIntervalSec || '30'}#`,
    ],
  },
  {
    id: 'queclink',
    label: 'Queclink GV / GL',
    manufacturer: 'Queclink',
    protocol: 'Queclink ASCII',
    transport: 'tcp',
    defaultPort: TRACKPRO_GPS_PORT,
    defaultModel: 'GV55',
    models: ['GV20', 'GV55', 'GV55W', 'GV75', 'GV500', 'GV600', 'GL300', 'GL320', 'Otro'],
    summary: 'Registro e inventario con parametros de red listos para validar integracion.',
    commands: ({ host, port, apn, reportIntervalSec }) => [
      `APN: ${apn || 'apn.operador'}`,
      `Servidor primario: ${host}:${port}`,
      `Reporte: cada ${reportIntervalSec || '30'} segundos`,
    ],
  },
  {
    id: 'generic',
    label: 'Otro GPS TCP/UDP',
    manufacturer: 'Otra marca',
    protocol: 'Pendiente de validar',
    transport: 'tcp',
    defaultPort: TRACKPRO_GPS_PORT,
    defaultModel: 'Otro',
    models: ['Sinotrack ST-901', 'Sinotrack ST-906', 'Coban TK103', 'Coban TK303', 'Ruptela FM-Eco4', 'CalAmp LMU-3030', 'Otro'],
    summary: 'Captura completa para equipos que requieren APN, host, puerto, transporte o IP fija.',
    commands: ({ host, port, apn, reportIntervalSec }) => [
      `APN: ${apn || 'apn.operador'}`,
      `Host/IP destino: ${host}`,
      `Puerto destino: ${port}`,
      `Frecuencia: ${reportIntervalSec || '30'} segundos`,
    ],
  },
]

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  online:   { color: '#22C55E', bg: '#F0FDF4', label: 'En línea' },
  offline:  { color: '#6B7280', bg: '#F9FAFB', label: 'Desconectado' },
  no_signal:{ color: '#EAB308', bg: '#FEFCE8', label: 'Sin señal' },
  unknown:  { color: '#9CA3AF', bg: '#F3F4F6', label: 'Desconocido' },
  pending_mobile: { color: '#0D9488', bg: '#F0FDFA', label: 'Pendiente de app' },
  mobile_paused: { color: '#DC2626', bg: '#FEF2F2', label: 'Rastreo pausado' },
}

function isMobileOnline(device: Device) {
  return device.source_type === 'mobile' && device.tracking_enabled !== false && Boolean(device.last_seen)
}

function getEffectiveDeviceStatus(device: Device) {
  if (isMobileOnline(device)) return 'online'
  if (device.source_type === 'mobile' && device.tracking_enabled === false) return 'mobile_paused'
  if (device.source_type === 'mobile' && !device.last_seen) return 'pending_mobile'
  return device.status
}

export default function DevicesPage() {
  const { canWriteFleet, role, companyId } = usePermissions()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [simDevice, setSimDevice] = useState<Device | null>(null)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter] = useState<'all' | 'hardware' | 'mobile'>('all')
  const needsCompanyPick = role === 'super_admin' && !companyId

  const loadDevices = useCallback(async () => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('source_type', filter)
    const res  = await fetch(`/api/devices?${params}`)
    if (res.status === 401) {
      window.location.href = '/login?error=no_session'
      return
    }
    const data = await res.json()
    setDevices(data.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { void loadDevices() }, [loadDevices])

  async function deleteDevice(device: Device) {
    if (!canWriteFleet || deletingId) return
    const label = device.source_type === 'mobile' ? `movil ${device.model}` : `GPS ${device.imei}`
    if (!confirm(`Eliminar ${label}? Esta accion quitara el dispositivo de TrackProGPS.`)) return

    setDeletingId(device.id)
    try {
      const res = await fetch(`/api/devices/${device.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudo eliminar el dispositivo')
      await loadDevices()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar el dispositivo')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = devices.filter(d =>
    d.imei.includes(search) || d.model.toLowerCase().includes(search.toLowerCase()) ||
    (d.vehicle?.plates ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const mobileNeedingActivation = filtered.find(d =>
    d.source_type === 'mobile' &&
    d.tracking_enabled !== false &&
    !d.last_seen
  )

  const stats = {
    total:   devices.length,
    online:  devices.filter(d => getEffectiveDeviceStatus(d) === 'online').length,
    activeMobile: devices.filter(d => isMobileOnline(d)).length,
    offline: devices.filter(d =>
      getEffectiveDeviceStatus(d) !== 'online' &&
      (d.source_type !== 'mobile' || d.tracking_enabled === false || !d.last_seen)
    ).length,
  }

  return (
    <div className="p-4 pb-28 sm:p-6 lg:pb-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dispositivos GPS</h1>
          <p className="text-xs text-gray-400 mt-1">
            GPS hardware (Teltonika y más) · Móviles de choferes (opcional en plan flota)
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>{stats.total} total</span>
            <span className="text-green-600 font-medium">● {stats.online} en línea</span>
            <span className="text-teal-600 font-medium">● {stats.activeMobile} móviles activos</span>
            <span className="text-gray-400">○ {stats.offline} pendientes/pausados</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadDevices()} className="p-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canWriteFleet && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
            <Plus className="w-4 h-4" /> Registrar dispositivo
          </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'hardware', 'mobile'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              filter === f ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            {f === 'all' ? 'Todos' : f === 'hardware' ? 'GPS vehículo' : 'Móviles'}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por IMEI, modelo o placas..."
          className="w-full max-w-sm border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </div>

      {mobileNeedingActivation && (
        <MobilePermissionSetup
          deviceId={mobileNeedingActivation.id}
          activationHref={`/descargar?device_id=${mobileNeedingActivation.id}`}
          title="Reactivar GPS del movil"
          description="Abre el enlace en el telefono asignado y toca Autorizar app para volver a enviarlo en vivo."
          onActivated={() => void loadDevices()}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="divide-y divide-gray-100 lg:hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">No se encontraron dispositivos</div>
            ) : filtered.map(d => {
              const effectiveStatus = getEffectiveDeviceStatus(d)
              const isPendingMobile = effectiveStatus === 'pending_mobile'
              const cfg = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES['unknown']!
              const contact = getDeviceContactSummary(d)
              const ownerSummary = getDeviceOwnerSummary(d)
              const mobileSummary = getMobileDeviceSummary(d)
              const simRecharge = getLatestSimRecharge(d)
              const simStatus = simRecharge ? getSimRechargeStatus(simRecharge) : null
              const assignment = d.source_type === 'mobile'
                ? ownerSummary || 'Movil / persona'
                : d.vehicle
                  ? `${d.vehicle.economic_num} (${d.vehicle.plates})`
                  : 'Sin asignar'
              const lastSeen = d.last_seen ? (() => {
                const s = Math.floor((Date.now() - new Date(d.last_seen).getTime()) / 1000)
                if (s < 60) return `Hace ${s}s`
                if (s < 3600) return `Hace ${Math.floor(s / 60)}min`
                if (s < 86400) return `Hace ${Math.floor(s / 3600)}h`
                return new Date(d.last_seen).toLocaleDateString('es-MX')
              })() : (isPendingMobile ? 'Sin telemetria' : 'Nunca')

              return (
                <div key={d.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Link href={`/devices/${d.id}`} className="flex min-w-0 flex-1 items-start gap-2 group">
                      {d.source_type === 'mobile'
                        ? <Smartphone className="mt-1 h-4 w-4 flex-shrink-0 text-teal-500" />
                        : <Radio className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-orange-500" />}
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 group-hover:text-orange-500">{d.model}</div>
                        {d.source_type === 'mobile' && <div className="text-xs text-teal-600">App movil</div>}
                        {ownerSummary && <div className="text-xs text-gray-600">Propietario: {ownerSummary}</div>}
                        {mobileSummary && <div className="text-xs text-gray-500">{mobileSummary}</div>}
                        {d.firmware_ver && <div className="text-xs text-gray-400">FW: {d.firmware_ver}</div>}
                      </div>
                    </Link>
                    <span
                      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' }}
                    >
                      {effectiveStatus === 'online' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {cfg.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <InfoBlock label="IMEI" value={d.imei} mono />
                    <InfoBlock label="SIM" value={d.phone_num ?? d.sim_iccid?.slice(-8) ?? '-'} />
                    <InfoBlock label="Asignacion" value={assignment} accent={d.source_type === 'mobile' ? 'teal' : 'orange'} />
                    <InfoBlock label="Ultima conexion" value={lastSeen} />
                  </div>

                  {d.source_type !== 'mobile' && simStatus && (
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium">
                      <span className={simStatus.className + ' inline-flex items-center gap-1 rounded-full px-2 py-1'}>
                        <CalendarDays className="h-3 w-3" />
                        {simStatus.label}
                      </span>
                    </div>
                  )}

                  {(contact.responsible || contact.emergency || isPendingMobile) && (
                    <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      {contact.responsible && <div>Resp: {contact.responsible}</div>}
                      {contact.emergency && <div>Emerg: {contact.emergency}</div>}
                      {d.source_type === 'mobile' && isPendingMobile && (
                        <div className="font-medium text-orange-600">Reactivar GPS desde el enlace superior</div>
                      )}
                    </div>
                  )}

                  {canWriteFleet && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingDevice(d)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      {d.source_type !== 'mobile' && (
                        <button
                          type="button"
                          onClick={() => setSimDevice(d)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-100 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                        >
                          <CreditCard className="h-4 w-4" />
                          Saldo chip
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingId === d.id}
                        onClick={() => void deleteDevice(d)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <table className="hidden w-full text-sm lg:table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Dispositivo', 'IMEI', 'SIM', 'Asignacion', 'Estado', 'Ultima conexion', 'Acciones'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${h === 'Acciones' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-400 text-sm">No se encontraron dispositivos</td></tr>
              ) : filtered.map(d => {
                const effectiveStatus = getEffectiveDeviceStatus(d)
                const isPendingMobile = effectiveStatus === 'pending_mobile'
                const cfg = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES['unknown']!
                const contact = getDeviceContactSummary(d)
                const ownerSummary = getDeviceOwnerSummary(d)
                const mobileSummary = getMobileDeviceSummary(d)
                const simRecharge = getLatestSimRecharge(d)
                const simStatus = simRecharge ? getSimRechargeStatus(simRecharge) : null
                const lastSeen = d.last_seen ? (() => {
                  const s = Math.floor((Date.now() - new Date(d.last_seen).getTime()) / 1000)
                  if (s < 60) return `Hace ${s}s`
                  if (s < 3600) return `Hace ${Math.floor(s / 60)}min`
                  if (s < 86400) return `Hace ${Math.floor(s / 3600)}h`
                  return new Date(d.last_seen).toLocaleDateString('es-MX')
                })() : (isPendingMobile ? 'Sin telemetría' : 'Nunca')

                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/devices/${d.id}`} className="flex items-center gap-2 group">
                        {d.source_type === 'mobile'
                          ? <Smartphone className="w-4 h-4 text-teal-500" />
                          : <Radio className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />}
                        <div>
                          <div className="font-semibold text-gray-900 group-hover:text-orange-500">{d.model}</div>
                          {d.source_type === 'mobile' && <div className="text-xs text-teal-600">App móvil</div>}
                          {ownerSummary && <div className="text-xs text-gray-600">Propietario: {ownerSummary}</div>}
                          {mobileSummary && <div className="text-xs text-gray-500">{mobileSummary}</div>}
                          {d.firmware_ver && <div className="text-xs text-gray-400">FW: {d.firmware_ver}</div>}
                          {(contact.responsible || contact.emergency) && (
                            <div className="mt-1 text-xs text-gray-500">
                              {contact.responsible && <div>Resp: {contact.responsible}</div>}
                              {contact.emergency && <div>Emerg: {contact.emergency}</div>}
                            </div>
                          )}
                          {d.source_type === 'mobile' && isPendingMobile && (
                            <span className="mt-1 inline-flex text-xs font-medium text-orange-600">
                              Reactivar GPS desde el enlace superior
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.imei}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>{d.phone_num ?? d.sim_iccid?.slice(-8) ?? '—'}</div>
                      {d.source_type !== 'mobile' && simStatus && (
                        <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${simStatus.className}`}>
                          <CalendarDays className="h-3 w-3" />
                          {simStatus.label}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.source_type === 'mobile'
                        ? <span className="text-sm font-medium text-teal-600">{ownerSummary || 'Movil / persona'}</span>
                        : d.vehicle
                        ? <span className="text-sm font-medium text-orange-500">{d.vehicle.economic_num} ({d.vehicle.plates})</span>
                        : <span className="text-xs text-gray-400">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border`}
                        style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' }}>
                        {effectiveStatus === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{lastSeen}</td>
                    <td className="px-4 py-3 text-right">
                      {canWriteFleet && (
                        <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDevice(d)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                          aria-label="Editar dispositivo"
                          title="Editar dispositivo"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {d.source_type !== 'mobile' && (
                          <button
                            type="button"
                            onClick={() => setSimDevice(d)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50"
                            aria-label="Saldo chip"
                            title="Saldo chip"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === d.id}
                          onClick={() => void deleteDevice(d)}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-100 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label="Eliminar dispositivo"
                          title="Eliminar dispositivo"
                        >
                          {deletingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          <span>Eliminar</span>
                        </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && canWriteFleet && (
        <DeviceModal
          needsCompanyPick={needsCompanyPick}
          currentCompanyId={companyId}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); void loadDevices() }}
        />
      )}
      {simDevice && canWriteFleet && (
        <SimBalanceModal
          device={simDevice}
          onClose={() => setSimDevice(null)}
          onSaved={() => { setSimDevice(null); void loadDevices() }}
        />
      )}
      {editingDevice && canWriteFleet && (
        <DeviceEditModal
          device={editingDevice}
          onClose={() => setEditingDevice(null)}
          onSaved={() => { setEditingDevice(null); void loadDevices() }}
        />
      )}
    </div>
  )
}

function getDeviceContactSummary(device: Device): ContactSummary {
  const metadata = device.source_type === 'mobile' ? device.mobile_metadata : device.protocol_metadata
  if (!metadata || typeof metadata !== 'object') return {}

  const responsible = metadata.responsible_contact
  const emergencyContacts = metadata.emergency_contacts
  const firstEmergency = Array.isArray(emergencyContacts) ? emergencyContacts[0] : null

  return {
    responsible: readContactName(responsible),
    emergency: readContactName(firstEmergency),
  }
}

function InfoBlock({
  label,
  value,
  mono = false,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: 'orange' | 'teal'
}) {
  const accentClass = accent === 'orange'
    ? 'text-orange-600'
    : accent === 'teal'
      ? 'text-teal-600'
      : 'text-gray-900'

  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 break-words text-xs font-medium ${mono ? 'font-mono text-gray-600' : accentClass}`}>
        {value}
      </div>
    </div>
  )
}

function readObject(source: unknown, key: string): Record<string, unknown> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const value = (source as Record<string, unknown>)[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function readRecordString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

function readNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getDeviceOwnerSummary(device: Device): string {
  const metadata = device.source_type === 'mobile' ? device.mobile_metadata : device.protocol_metadata
  if (!metadata || typeof metadata !== 'object') return ''
  const owner = metadata.device_owner
  if (!owner || typeof owner !== 'object' || Array.isArray(owner)) return ''
  const name = (owner as { name?: unknown }).name
  return typeof name === 'string' && name.trim() ? name.trim() : ''
}

function readContactName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const name = (value as { name?: unknown }).name
  return typeof name === 'string' && name.trim() ? name.trim() : undefined
}

function getMobileDeviceSummary(device: Device): string {
  if (device.source_type !== 'mobile') return ''
  const metadata = device.mobile_metadata
  if (!metadata || typeof metadata !== 'object') return ''

  const brand = readMetadataString(metadata, 'brand')
  const model = readMetadataString(metadata, 'model')
  const osVersion = readMetadataString(metadata, 'os_version')
  const appVersion = readMetadataString(metadata, 'app_version')
  const hardware = [brand, model].filter(Boolean).join(' ')
  const software = [
    osVersion ? `OS ${osVersion}` : '',
    appVersion ? `App ${appVersion}` : '',
  ].filter(Boolean).join(' · ')

  return [hardware, software].filter(Boolean).join(' · ')
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getLatestSimRecharge(device: Device): SimRecharge | null {
  return device.sim_recharges?.[0] ?? null
}

function getSimRechargeStatus(recharge: SimRecharge) {
  const today = startOfLocalDay(new Date())
  const due = startOfLocalDay(new Date(`${recharge.next_recharge_date}T00:00:00`))
  const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)

  if (daysLeft < 0) {
    return {
      daysLeft,
      label: `Vencido ${Math.abs(daysLeft)}d`,
      className: 'bg-red-50 text-red-700 border border-red-100',
    }
  }
  if (daysLeft === 0) {
    return {
      daysLeft,
      label: 'Vence hoy',
      className: 'bg-red-50 text-red-700 border border-red-100',
    }
  }
  if (daysLeft <= recharge.alert_days_before) {
    return {
      daysLeft,
      label: `Recargar en ${daysLeft}d`,
      className: 'bg-amber-50 text-amber-700 border border-amber-100',
    }
  }
  return {
    daysLeft,
    label: `${daysLeft}d saldo`,
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  }
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function DeviceModal({
  needsCompanyPick,
  currentCompanyId,
  onClose,
  onSave,
}: {
  needsCompanyPick: boolean
  currentCompanyId?: string | null
  onClose: () => void
  onSave: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [companyId, setCompanyId] = useState('')
  const [mode, setMode] = useState<DeviceSetupMode>('hardware')
  const [hardware, setHardware] = useState({
    profileId: DEVICE_SETUP_PROFILES[0]!.id,
    imei: '',
    model: DEVICE_SETUP_PROFILES[0]!.defaultModel,
    model_custom: '',
    sim_iccid: '',
    phone_num: '',
    firmware_ver: '',
    server_host: TRACKPRO_GPS_HOST,
    server_port: TRACKPRO_GPS_PORT,
    transport: DEVICE_SETUP_PROFILES[0]!.transport,
    apn: '',
    apn_user: '',
    apn_pass: '',
    ip_mode: 'dynamic',
    static_ip: '',
    report_interval_sec: '30',
    install_notes: '',
  })
  const [mobile, setMobile] = useState({
    platform: 'android' as 'android' | 'ios',
    assigned_user_id: '',
    label: '',
    imei: '',
    sim_iccid: '',
    phone_num: '',
    firmware_ver: '',
    brand: '',
    model: '',
    os_version: '',
    app_version: '',
    device_notes: '',
    tracking_interval_sec: '30',
  })
  const [deviceOwner, setDeviceOwner] = useState<DeviceOwnerForm>({
    name: '',
    phone: '',
    email: '',
    address: '',
  })
  const [contacts, setContacts] = useState<ContactForm>({
    responsible_name: '',
    responsible_email: '',
    responsible_phone: '',
    emergency_name: '',
    emergency_phone: '',
    emergency_email: '',
    emergency_relationship: 'Contacto de emergencia',
  })
  const [simRecharge, setSimRecharge] = useState<SimRechargeForm>({
    enabled: false,
    carrier: 'Telcel',
    amount: '',
    recharge_date: todayInputValue(),
    validity_days: '30',
    alert_days_before: '3',
    notes: '',
  })

  const selectedProfile = DEVICE_SETUP_PROFILES.find(p => p.id === hardware.profileId) ?? DEVICE_SETUP_PROFILES[0]!
  const isCustomModel = hardware.model === 'Otro'
  const targetCompanyId = needsCompanyPick ? companyId : (currentCompanyId ?? '')
  const hardwareCommands = selectedProfile.commands({
    host: hardware.server_host,
    port: hardware.server_port,
    apn: hardware.apn,
    apnUser: hardware.apn_user,
    apnPass: hardware.apn_pass,
    reportIntervalSec: hardware.report_interval_sec,
  })

  const setHw = (field: keyof typeof hardware, value: string) => setHardware(prev => ({ ...prev, [field]: value }))
  const setMobileField = (field: keyof typeof mobile, value: string) => setMobile(prev => ({ ...prev, [field]: value }))
  const setOwnerField = (field: keyof DeviceOwnerForm, value: string) => setDeviceOwner(prev => ({ ...prev, [field]: value }))
  const setContactField = (field: keyof ContactForm, value: string) => setContacts(prev => ({ ...prev, [field]: value }))
  const setSimRechargeField = (field: keyof SimRechargeForm, value: string | boolean) => setSimRecharge(prev => ({ ...prev, [field]: value }))

  function handleAssignedUserChange(userId: string) {
    setMobileField('assigned_user_id', userId)
    const selectedUser = users.find(user => user.id === userId)
    if (!selectedUser) return
    setDeviceOwner(prev => ({
      ...prev,
      name: prev.name || selectedUser.full_name,
      email: prev.email || selectedUser.email,
    }))
    setContacts(prev => ({
      ...prev,
      responsible_name: prev.responsible_name || selectedUser.full_name,
      responsible_email: prev.responsible_email || selectedUser.email,
    }))
  }

  function buildDeviceOwnerPayload() {
    const ownerName = deviceOwner.name.trim()
    const ownerPhone = deviceOwner.phone.trim()
    if (!ownerName) throw new Error('Escribe el nombre del propietario')
    if (!ownerPhone) throw new Error('Escribe el telefono del propietario')

    return {
      device_owner: {
        name: ownerName,
        phone: ownerPhone,
        email: deviceOwner.email.trim() || null,
        address: deviceOwner.address.trim() || null,
      },
    }
  }

  function buildContactPayload() {
    const responsibleName = contacts.responsible_name.trim()
    const responsiblePhone = contacts.responsible_phone.trim()
    const emergencyName = contacts.emergency_name.trim()
    const emergencyPhone = contacts.emergency_phone.trim()

    if (!responsibleName) throw new Error('Escribe el nombre del responsable')
    if (!responsiblePhone) throw new Error('Escribe el celular del responsable')
    if (!emergencyName) throw new Error('Escribe el contacto de emergencia')
    if (!emergencyPhone) throw new Error('Escribe el celular del contacto de emergencia')

    return {
      responsible_contact: {
        name: responsibleName,
        phone: responsiblePhone,
        email: contacts.responsible_email.trim() || null,
      },
      emergency_contacts: [{
        name: emergencyName,
        phone: emergencyPhone,
        email: contacts.emergency_email.trim() || null,
        relationship: contacts.emergency_relationship.trim() || null,
        priority: 1,
      }],
    }
  }

  useEffect(() => {
    if (!needsCompanyPick) return
    void fetch('/api/admin/companies')
      .then(r => r.json())
      .then(json => setCompanies(json.data ?? []))
  }, [needsCompanyPick])

  useEffect(() => {
    if (mode !== 'mobile') return
    if (needsCompanyPick && !companyId) {
      setUsers([])
      setMobile(prev => ({ ...prev, assigned_user_id: '' }))
      return
    }
    const query = targetCompanyId ? `?company_id=${targetCompanyId}` : ''
    void fetch(`/api/users${query}`)
      .then(r => r.json())
      .then(json => setUsers(json.data ?? []))
      .catch(() => setUsers([]))
  }, [mode, needsCompanyPick, companyId, targetCompanyId])

  function selectProfile(profileId: string) {
    const profile = DEVICE_SETUP_PROFILES.find(p => p.id === profileId) ?? DEVICE_SETUP_PROFILES[0]!
    setHardware(prev => ({
      ...prev,
      profileId: profile.id,
      model: profile.defaultModel,
      model_custom: '',
      server_port: profile.defaultPort,
      transport: profile.transport,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (needsCompanyPick && !companyId) throw new Error('Selecciona la empresa cliente')

      let payload: Record<string, unknown>
      const contactPayload = buildContactPayload()
      const ownerPayload = mode === 'mobile'
        ? { device_owner: {
            name: contacts.responsible_name.trim(),
            phone: contacts.responsible_phone.trim(),
            email: contacts.responsible_email.trim() || null,
            address: null,
          }}
        : buildDeviceOwnerPayload()
      if (mode === 'mobile') {
        if (!mobile.assigned_user_id) throw new Error('Selecciona el usuario que usara este telefono')
        if (mobile.imei.trim() && !/^\d{15}$/.test(mobile.imei.trim())) throw new Error('El IMEI del movil debe tener 15 digitos')
        if (!mobile.phone_num.trim()) throw new Error('Escribe el telefono SIM del movil')
        payload = {
          source_type: 'mobile',
          assigned_user_id: mobile.assigned_user_id,
          platform: mobile.platform,
          label: mobile.label.trim() || undefined,
          imei: mobile.imei.trim() || undefined,
          sim_iccid: mobile.sim_iccid.trim() || null,
          phone_num: mobile.phone_num.trim(),
          firmware_ver: mobile.firmware_ver.trim() || null,
          brand: mobile.brand.trim() || null,
          model: mobile.model.trim() || null,
          os_version: mobile.os_version.trim() || null,
          app_version: mobile.app_version.trim() || null,
          device_notes: mobile.device_notes.trim() || null,
          tracking_interval_sec: Number(mobile.tracking_interval_sec) || 30,
          ...ownerPayload,
          ...contactPayload,
        }
      } else {
        const finalModel = isCustomModel ? hardware.model_custom.trim() : hardware.model
        if (!finalModel) throw new Error('Escribe el modelo del GPS')
        const shouldSaveRecharge = simRecharge.enabled
        const validityDays = Number(simRecharge.validity_days) || 30
        const alertDaysBefore = Number(simRecharge.alert_days_before) || 3
        if (shouldSaveRecharge && !simRecharge.carrier.trim()) throw new Error('Selecciona la compania telefonica del chip')
        if (shouldSaveRecharge && !simRecharge.recharge_date) throw new Error('Escribe la fecha de recarga del chip')
        payload = {
          source_type: 'hardware',
          imei: hardware.imei.trim(),
          model: finalModel,
          sim_iccid: hardware.sim_iccid.trim() || null,
          phone_num: hardware.phone_num.trim() || null,
          firmware_ver: hardware.firmware_ver.trim() || null,
          protocol_metadata: {
            setup_profile: selectedProfile.id,
            manufacturer: selectedProfile.manufacturer,
            protocol: selectedProfile.protocol,
            transport: hardware.transport,
            server_host: hardware.server_host.trim(),
            server_port: Number(hardware.server_port) || Number(selectedProfile.defaultPort),
            ip_mode: hardware.ip_mode,
            static_ip: hardware.ip_mode === 'static' ? hardware.static_ip.trim() || null : null,
            apn: hardware.apn.trim() || null,
            apn_user: hardware.apn_user.trim() || null,
            apn_pass: hardware.apn_pass.trim() || null,
            report_interval_sec: Number(hardware.report_interval_sec) || 30,
            install_notes: hardware.install_notes.trim() || null,
            command_preview: hardwareCommands,
            ...ownerPayload,
            ...contactPayload,
            configured_at: new Date().toISOString(),
          },
          sim_recharge: shouldSaveRecharge ? {
            carrier: simRecharge.carrier.trim(),
            amount: simRecharge.amount.trim() ? Number(simRecharge.amount) : null,
            recharge_date: simRecharge.recharge_date,
            validity_days: validityDays,
            alert_days_before: alertDaysBefore,
            notes: simRecharge.notes.trim() || null,
          } : null,
        }
      }

      if (needsCompanyPick) payload.company_id = companyId
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92dvh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Registrar dispositivo TrackProGPS</h2>
            <p className="text-sm text-gray-500 mt-1">Alta guiada para GPS vehicular, Protrack, Teltonika, otras marcas y moviles.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {needsCompanyPick && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Empresa cliente *</label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)} required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Seleccionar empresa</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.account_type})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">La empresa define donde quedara asignado el GPS o movil.</p>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={() => setMode('hardware')}
                className={`text-left rounded-2xl border p-4 transition ${mode === 'hardware' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'hardware' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">GPS vehicular</div>
                    <div className="text-xs text-gray-500">IMEI, SIM, APN, host/IP, puerto y comandos.</div>
                  </div>
                </div>
              </button>
              <button type="button" onClick={() => setMode('mobile')}
                className={`text-left rounded-2xl border p-4 transition ${mode === 'mobile' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'mobile' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Movil Android / iOS</div>
                    <div className="text-xs text-gray-500">IMEI, SIM, firmware, usuario y permisos.</div>
                  </div>
                </div>
              </button>
            </div>

            {mode === 'hardware' ? (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Cpu className="w-4 h-4 text-orange-500" />
                    Identificacion del equipo
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Marca / perfil de configuracion *</label>
                    <select value={hardware.profileId} onChange={e => selectProfile(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {DEVICE_SETUP_PROFILES.map(profile => (
                        <option key={profile.id} value={profile.id}>{profile.label}</option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-gray-500">{selectedProfile.summary}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="IMEI (15 digitos) *" value={hardware.imei} onChange={v => setHw('imei', v)} placeholder="123456789012345" required maxLength={15} mono />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo *</label>
                      <select value={hardware.model} onChange={e => setHw('model', e.target.value)} required
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        {selectedProfile.models.map(model => <option key={model} value={model}>{model}</option>)}
                      </select>
                      {isCustomModel && (
                        <input value={hardware.model_custom} onChange={e => setHw('model_custom', e.target.value)}
                          placeholder="Modelo exacto" required
                          className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      )}
                    </div>
                    <TextField label="ICCID de SIM" value={hardware.sim_iccid} onChange={v => setHw('sim_iccid', v)} placeholder="8952140..." mono />
                    <TextField label="Telefono SIM" value={hardware.phone_num} onChange={v => setHw('phone_num', v)} placeholder="+52 55 ..." />
                    <TextField label="Firmware" value={hardware.firmware_ver} onChange={v => setHw('firmware_ver', v)} placeholder="03.27.07.Rev.07" />
                    <TextField label="Intervalo de reporte (seg)" value={hardware.report_interval_sec} onChange={v => setHw('report_interval_sec', v)} placeholder="30" type="number" min={5} />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Server className="w-4 h-4 text-orange-500" />
                    Red, IP y servidor
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Servidor / dominio TrackPro *" value={hardware.server_host} onChange={v => setHw('server_host', v)} placeholder={TRACKPRO_GPS_HOST} required />
                    <TextField label="Puerto *" value={hardware.server_port} onChange={v => setHw('server_port', v)} placeholder="5000" type="number" min={1} required />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Transporte</label>
                      <select value={hardware.transport} onChange={e => setHw('transport', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                        <option value="http">HTTP</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">IP del SIM</label>
                      <select value={hardware.ip_mode} onChange={e => setHw('ip_mode', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="dynamic">Dinamica / no aplica</option>
                        <option value="static">IP fija empresarial</option>
                      </select>
                    </div>
                    {hardware.ip_mode === 'static' && (
                      <TextField label="IP fija del SIM" value={hardware.static_ip} onChange={v => setHw('static_ip', v)} placeholder="187.000.000.000" />
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextField label="APN" value={hardware.apn} onChange={v => setHw('apn', v)} placeholder="internet.itelcel.com" />
                    <TextField label="Usuario APN" value={hardware.apn_user} onChange={v => setHw('apn_user', v)} placeholder="webgprs" />
                    <TextField label="Password APN" value={hardware.apn_pass} onChange={v => setHw('apn_pass', v)} placeholder="webgprs2002" />
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-orange-900 mb-3">
                      <ClipboardList className="w-4 h-4" />
                      Guia rapida para configurar
                    </div>
                    <div className="space-y-2">
                      {hardwareCommands.map((cmd, index) => (
                        <div key={`${cmd}-${index}`} className="rounded-lg bg-white/80 border border-orange-100 px-3 py-2 font-mono text-xs text-gray-700">
                          {cmd}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-orange-800">
                      La IP del GPS normalmente no se asigna aqui: se configura el equipo para reportar a este host y puerto. Usa IP fija solo si el SIM empresarial la incluye.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas de instalacion</label>
                    <textarea value={hardware.install_notes} onChange={e => setHw('install_notes', e.target.value)}
                      placeholder="Ubicacion del equipo, operador SIM, observaciones de instalacion..."
                      className="w-full min-h-20 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </section>

                <section className="lg:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Saldo chip</div>
                        <p className="mt-1 text-xs text-blue-900">
                          Guarda la fecha de recarga y TrackProGPS avisara 3 dias antes de que venza el paquete.
                        </p>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-blue-900">
                      <input
                        type="checkbox"
                        checked={simRecharge.enabled}
                        onChange={e => setSimRechargeField('enabled', e.target.checked)}
                        className="rounded border-blue-300"
                      />
                      Registrar recarga inicial
                    </label>
                  </div>

                  {simRecharge.enabled && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Compania telefonica *</label>
                        <select
                          value={simRecharge.carrier}
                          onChange={e => setSimRechargeField('carrier', e.target.value)}
                          className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CARRIER_OPTIONS.map(carrier => <option key={carrier} value={carrier}>{carrier}</option>)}
                        </select>
                      </div>
                      <TextField label="Fecha de recarga *" value={simRecharge.recharge_date} onChange={v => setSimRechargeField('recharge_date', v)} type="date" required />
                      <TextField label="Vigencia dias" value={simRecharge.validity_days} onChange={v => setSimRechargeField('validity_days', v)} type="number" min={1} />
                      <TextField label="Avisar dias antes" value={simRecharge.alert_days_before} onChange={v => setSimRechargeField('alert_days_before', v)} type="number" min={0} />
                      <TextField label="Monto" value={simRecharge.amount} onChange={v => setSimRechargeField('amount', v)} type="number" min={0} placeholder="100" />
                      <div className="sm:col-span-2 lg:col-span-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas de saldo</label>
                        <textarea
                          value={simRecharge.notes}
                          onChange={e => setSimRechargeField('notes', e.target.value)}
                          placeholder="Paquete mensual, folio, sucursal o comentario operativo..."
                          className="w-full min-h-16 border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-teal-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="w-4 h-4" />
                      Flujo de activacion
                    </div>
                    <StepLine icon={<Smartphone className="w-4 h-4" />} text="Datos del celular" />
                    <StepLine icon={<Phone className="w-4 h-4" />} text="Responsable y emergencia" />
                    <StepLine icon={<Wifi className="w-4 h-4" />} text="Conectar movil" />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Smartphone className="w-4 h-4 text-teal-600" />
                    Datos del celular
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Plataforma *</label>
                      <select value={mobile.platform} onChange={e => setMobileField('platform', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="android">Android</option>
                        <option value="ios">iPhone / iOS</option>
                      </select>
                    </div>
                    <TextField label="Nombre visible" value={mobile.label} onChange={v => setMobileField('label', v)} placeholder="Telefono del operador" />
                    <TextField label="IMEI del movil" value={mobile.imei} onChange={v => setMobileField('imei', v)} placeholder="123456789012345" maxLength={15} mono />
                    <TextField label="ICCID de SIM" value={mobile.sim_iccid} onChange={v => setMobileField('sim_iccid', v)} placeholder="8952140..." mono />
                    <TextField label="Telefono SIM *" value={mobile.phone_num} onChange={v => setMobileField('phone_num', v)} placeholder="5551234567" required />
                    <TextField label="Firmware" value={mobile.firmware_ver} onChange={v => setMobileField('firmware_ver', v)} placeholder="Firmware / build del equipo" />
                    <TextField label="Marca" value={mobile.brand} onChange={v => setMobileField('brand', v)} placeholder="Apple, Samsung, Motorola..." />
                    <TextField label="Modelo" value={mobile.model} onChange={v => setMobileField('model', v)} placeholder="iPhone 15, Galaxy A54..." />
                    <TextField label="Version sistema" value={mobile.os_version} onChange={v => setMobileField('os_version', v)} placeholder="iOS 17, Android 14..." />
                    <TextField label="Version app" value={mobile.app_version} onChange={v => setMobileField('app_version', v)} placeholder="web-pwa" />
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuario asignado *</label>
                      <select value={mobile.assigned_user_id} onChange={e => handleAssignedUserChange(e.target.value)} required
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="">{needsCompanyPick && !companyId ? 'Selecciona primero una empresa' : 'Seleccionar usuario'}</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.full_name} - {user.email}</option>
                        ))}
                      </select>
                    </div>
                    <TextField label="Intervalo de reporte (seg)" value={mobile.tracking_interval_sec} onChange={v => setMobileField('tracking_interval_sec', v)} placeholder="30" type="number" min={5} />
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas del movil</label>
                      <textarea
                        value={mobile.device_notes}
                        onChange={e => setMobileField('device_notes', e.target.value)}
                        placeholder="Equipo asignado, area, turno, observaciones o restricciones..."
                        className="w-full min-h-20 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {mode === 'hardware' && (
            <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <User className="w-4 h-4 text-indigo-600" />
                Propietario
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Nombre del propietario *" value={deviceOwner.name} onChange={v => setOwnerField('name', v)} placeholder="Persona a quien pertenece" required />
                <TextField label="Telefono del propietario *" value={deviceOwner.phone} onChange={v => setOwnerField('phone', v)} placeholder="5551234567" required />
                <TextField label="Correo del propietario" value={deviceOwner.email} onChange={v => setOwnerField('email', v)} placeholder="propietario@correo.com" type="email" />
                <TextField label="Direccion del propietario" value={deviceOwner.address} onChange={v => setOwnerField('address', v)} placeholder="Calle, colonia, ciudad" />
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-white bg-white/80 px-3 py-2 text-xs text-gray-500">
                <User className="w-4 h-4 shrink-0 text-gray-400" />
                El propietario puede ser diferente al usuario que entra a la plataforma o al operador asignado.
              </div>
            </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                Responsable y emergencia
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <User className="w-4 h-4" />
                    Persona responsable
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                    <TextField label="Nombre responsable *" value={contacts.responsible_name} onChange={v => setContactField('responsible_name', v)} placeholder="Nombre del responsable" required />
                  </div>
                    <TextField label="Celular responsable *" value={contacts.responsible_phone} onChange={v => setContactField('responsible_phone', v)} placeholder="5551234567" required />
                    <TextField label="Correo responsable" value={contacts.responsible_email} onChange={v => setContactField('responsible_email', v)} placeholder="responsable@empresa.com" type="email" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <Phone className="w-4 h-4" />
                    Contacto de emergencia
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <TextField label="Nombre emergencia *" value={contacts.emergency_name} onChange={v => setContactField('emergency_name', v)} placeholder="Nombre del contacto" required />
                    </div>
                    <TextField label="Celular emergencia *" value={contacts.emergency_phone} onChange={v => setContactField('emergency_phone', v)} placeholder="5559876543" required />
                    <TextField label="Correo emergencia" value={contacts.emergency_email} onChange={v => setContactField('emergency_email', v)} placeholder="emergencia@empresa.com" type="email" />
                    <div className="sm:col-span-2">
                      <TextField label="Relacion" value={contacts.emergency_relationship} onChange={v => setContactField('emergency_relationship', v)} placeholder="Familiar, supervisor, seguridad..." />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-white bg-white/80 px-3 py-2 text-xs text-gray-500">
                <Mail className="w-4 h-4 shrink-0 text-gray-400" />
                Estos datos quedan ligados al dispositivo para alertas de panico, seguimiento operativo y soporte.
              </div>
            </section>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
          </div>

          <div className="border-t bg-white px-6 py-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="sm:w-40 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className={`sm:w-48 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2 ${mode === 'mobile' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-orange-500 hover:bg-orange-600'}`}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando...</> : mode === 'mobile' ? 'Conectar movil' : 'Registrar GPS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeviceEditModal({
  device,
  onClose,
  onSaved,
}: {
  device: Device
  onClose: () => void
  onSaved: () => void
}) {
  const metadata = device.source_type === 'mobile' ? device.mobile_metadata : device.protocol_metadata
  const owner = readObject(metadata, 'device_owner')
  const responsible = readObject(metadata, 'responsible_contact')
  const emergencyContacts = metadata && typeof metadata === 'object' && Array.isArray(metadata.emergency_contacts)
    ? metadata.emergency_contacts
    : []
  const emergency = emergencyContacts[0] && typeof emergencyContacts[0] === 'object'
    ? emergencyContacts[0] as Record<string, unknown>
    : {}

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [base, setBase] = useState({
    imei: device.imei ?? '',
    model: device.model ?? '',
    sim_iccid: device.sim_iccid ?? '',
    phone_num: device.phone_num ?? '',
    firmware_ver: device.firmware_ver ?? '',
    tracking_interval_sec: String(readNumber(device, 'tracking_interval_sec') || 30),
  })
  const [deviceOwner, setDeviceOwner] = useState<DeviceOwnerForm>({
    name: readRecordString(owner, 'name'),
    phone: readRecordString(owner, 'phone'),
    email: readRecordString(owner, 'email'),
    address: readRecordString(owner, 'address'),
  })
  const [contacts, setContacts] = useState<ContactForm>({
    responsible_name: '',
    responsible_email: '',
    responsible_phone: '',
    emergency_name: readRecordString(emergency, 'name') || readRecordString(responsible, 'name'),
    emergency_phone: readRecordString(emergency, 'phone') || readRecordString(responsible, 'phone'),
    emergency_email: readRecordString(emergency, 'email') || readRecordString(responsible, 'email'),
    emergency_relationship: readRecordString(emergency, 'relationship') || 'Contacto de emergencia',
  })
  const [mobileDetails, setMobileDetails] = useState({
    brand: metadata && typeof metadata === 'object' ? readMetadataString(metadata, 'brand') : '',
    model: metadata && typeof metadata === 'object' ? readMetadataString(metadata, 'model') : '',
    os_version: metadata && typeof metadata === 'object' ? readMetadataString(metadata, 'os_version') : '',
    app_version: metadata && typeof metadata === 'object' ? readMetadataString(metadata, 'app_version') : '',
    device_notes: metadata && typeof metadata === 'object' ? readMetadataString(metadata, 'device_notes') : '',
  })

  const setBaseField = (field: keyof typeof base, value: string) => setBase(prev => ({ ...prev, [field]: value }))
  const setOwnerField = (field: keyof DeviceOwnerForm, value: string) => setDeviceOwner(prev => ({ ...prev, [field]: value }))
  const setContactField = (field: keyof ContactForm, value: string) => setContacts(prev => ({ ...prev, [field]: value }))
  const setMobileField = (field: keyof typeof mobileDetails, value: string) => setMobileDetails(prev => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const ownerName = deviceOwner.name.trim()
      const ownerPhone = deviceOwner.phone.trim()
      const emergencyName = contacts.emergency_name.trim()
      const emergencyPhone = contacts.emergency_phone.trim()

      if (!base.model.trim()) throw new Error('Escribe el modelo del dispositivo')
      if (!/^\d{15}$/.test(base.imei.trim())) throw new Error('El IMEI debe tener 15 digitos')
      if (!ownerName) throw new Error('Escribe el nombre del propietario')
      if (!ownerPhone) throw new Error('Escribe el telefono del propietario')
      if (!emergencyName) throw new Error('Escribe el contacto de emergencia')
      if (!emergencyPhone) throw new Error('Escribe el telefono del contacto de emergencia')

      const payload: Record<string, unknown> = {
        imei: base.imei.trim(),
        model: base.model.trim(),
        sim_iccid: base.sim_iccid.trim() || null,
        phone_num: base.phone_num.trim() || null,
        firmware_ver: base.firmware_ver.trim() || null,
        tracking_interval_sec: Number(base.tracking_interval_sec) || 30,
        device_owner: {
          name: ownerName,
          phone: ownerPhone,
          email: deviceOwner.email.trim() || null,
          address: deviceOwner.address.trim() || null,
        },
        emergency_contacts: [{
          name: emergencyName,
          phone: emergencyPhone,
          email: contacts.emergency_email.trim() || null,
          relationship: contacts.emergency_relationship.trim() || null,
          priority: 1,
        }],
      }

      if (device.source_type === 'mobile') {
        payload.mobile_details = {
          brand: mobileDetails.brand.trim() || null,
          model: mobileDetails.model.trim() || null,
          os_version: mobileDetails.os_version.trim() || null,
          app_version: mobileDetails.app_version.trim() || null,
          device_notes: mobileDetails.device_notes.trim() || null,
        }
      } else {
        payload.protocol_details = {
          ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
          report_interval_sec: Number(base.tracking_interval_sec) || 30,
        }
      }

      const res = await fetch(`/api/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo editar el dispositivo')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo editar el dispositivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Editar dispositivo</h2>
            <p className="mt-1 text-sm text-gray-500">
              {device.source_type === 'mobile' ? 'Movil / persona' : 'GPS vehicular'} · {device.model}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-6">
            <section className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                {device.source_type === 'mobile' ? <Smartphone className="h-4 w-4 text-teal-600" /> : <Radio className="h-4 w-4 text-orange-500" />}
                Datos del dispositivo
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Modelo *" value={base.model} onChange={v => setBaseField('model', v)} required />
                <TextField label="IMEI *" value={base.imei} onChange={v => setBaseField('imei', v)} required maxLength={15} mono />
                <TextField label="ICCID de SIM" value={base.sim_iccid} onChange={v => setBaseField('sim_iccid', v)} mono />
                <TextField label="Telefono SIM" value={base.phone_num} onChange={v => setBaseField('phone_num', v)} />
                <TextField label="Firmware" value={base.firmware_ver} onChange={v => setBaseField('firmware_ver', v)} />
                <TextField label={device.source_type === 'mobile' ? 'Intervalo rastreo (seg)' : 'Intervalo reporte (seg)'} value={base.tracking_interval_sec} onChange={v => setBaseField('tracking_interval_sec', v)} type="number" min={5} />
              </div>
            </section>

            {device.source_type === 'mobile' && (
              <section className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
                <div className="mb-4 text-sm font-semibold text-gray-900">Datos del movil</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Marca" value={mobileDetails.brand} onChange={v => setMobileField('brand', v)} placeholder="Apple, Samsung..." />
                  <TextField label="Modelo celular" value={mobileDetails.model} onChange={v => setMobileField('model', v)} placeholder="iPhone, Galaxy..." />
                  <TextField label="Version sistema" value={mobileDetails.os_version} onChange={v => setMobileField('os_version', v)} placeholder="iOS 17, Android 14" />
                  <TextField label="Version app" value={mobileDetails.app_version} onChange={v => setMobileField('app_version', v)} placeholder="web-pwa" />
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas del movil</label>
                    <textarea
                      value={mobileDetails.device_notes}
                      onChange={e => setMobileField('device_notes', e.target.value)}
                      className="min-h-20 w-full rounded-xl border border-teal-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="mb-4 text-sm font-semibold text-gray-900">Propietario</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Nombre propietario *" value={deviceOwner.name} onChange={v => setOwnerField('name', v)} required />
                <TextField label="Telefono propietario *" value={deviceOwner.phone} onChange={v => setOwnerField('phone', v)} required />
                <TextField label="Correo propietario" value={deviceOwner.email} onChange={v => setOwnerField('email', v)} type="email" />
                <TextField label="Direccion propietario" value={deviceOwner.address} onChange={v => setOwnerField('address', v)} />
              </div>
            </section>

            <section className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="mb-4 text-sm font-semibold text-gray-900">Contactos de emergencia</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Nombre *" value={contacts.emergency_name} onChange={v => setContactField('emergency_name', v)} required />
                <TextField label="Telefono *" value={contacts.emergency_phone} onChange={v => setContactField('emergency_phone', v)} required />
                <TextField label="Correo" value={contacts.emergency_email} onChange={v => setContactField('emergency_email', v)} type="email" />
              </div>
            </section>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          </div>

          <div className="flex justify-end gap-2 border-t bg-white px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SimBalanceModal({
  device,
  onClose,
  onSaved,
}: {
  device: Device
  onClose: () => void
  onSaved: () => void
}) {
  const latest = getLatestSimRecharge(device)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [topUpLoading, setTopUpLoading] = useState(false)
  const [topUpMessage, setTopUpMessage] = useState('')
  const [error, setError] = useState('')
  const [recharges, setRecharges] = useState<SimRecharge[]>(device.sim_recharges ?? [])
  const [form, setForm] = useState({
    carrier: latest?.carrier ?? 'Telcel',
    amount: '',
    recharge_date: todayInputValue(),
    validity_days: String(latest?.validity_days ?? 30),
    alert_days_before: String(latest?.alert_days_before ?? 3),
    notes: '',
  })

  const current = recharges[0] ?? latest
  const status = current ? getSimRechargeStatus(current) : null

  const setField = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const loadRecharges = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/devices/${device.id}/sim-recharges`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar saldo chip')
      setRecharges(data.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar saldo chip')
    } finally {
      setLoading(false)
    }
  }, [device.id])

  useEffect(() => { void loadRecharges() }, [loadRecharges])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        carrier: form.carrier.trim(),
        amount: form.amount.trim() ? Number(form.amount) : null,
        recharge_date: form.recharge_date,
        validity_days: Number(form.validity_days) || 30,
        alert_days_before: Number(form.alert_days_before) || 3,
        notes: form.notes.trim() || null,
      }
      if (!payload.carrier) throw new Error('Selecciona la compania telefonica')
      if (!payload.recharge_date) throw new Error('Escribe la fecha de recarga')

      const res = await fetch(`/api/devices/${device.id}/sim-recharges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo registrar la recarga')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la recarga')
    } finally {
      setSaving(false)
    }
  }

  async function handleTopUp() {
    setTopUpLoading(true)
    setTopUpMessage('')
    setError('')
    try {
      const amount = Number(form.amount)
      if (!device.phone_num) throw new Error('Este dispositivo no tiene telefono SIM registrado')
      if (!form.carrier.trim()) throw new Error('Selecciona la compania telefonica')
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Escribe el monto a recargar')

      const res = await fetch(`/api/devices/${device.id}/sim-recharges/top-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: form.carrier.trim(),
          amount,
          phone_num: device.phone_num,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTopUpMessage(data.message ?? data.error ?? 'No se pudo iniciar la recarga real')
        return
      }
      setTopUpMessage(data.message ?? 'Recarga enviada al proveedor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la recarga real')
    } finally {
      setTopUpLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92dvh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Saldo chip</h2>
            <p className="text-sm text-gray-500 mt-1">
              {device.model} · IMEI {device.imei} · {device.phone_num ?? device.sim_iccid?.slice(-8) ?? 'SIM sin numero'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs font-medium uppercase text-gray-400">Compania</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{current?.carrier ?? 'Sin recarga'}</div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs font-medium uppercase text-gray-400">Proxima recarga</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {current ? new Date(`${current.next_recharge_date}T00:00:00`).toLocaleDateString('es-MX') : 'Pendiente'}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs font-medium uppercase text-gray-400">Estado</div>
                <div className="mt-1">
                  {status ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
                      <CalendarDays className="h-3 w-3" />
                      {status.label}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">Sin control</span>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-950 mb-4">
                <CreditCard className="h-4 w-4" />
                Registrar nueva recarga
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Compania telefonica *</label>
                  <select
                    value={form.carrier}
                    onChange={e => setField('carrier', e.target.value)}
                    className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CARRIER_OPTIONS.map(carrier => <option key={carrier} value={carrier}>{carrier}</option>)}
                  </select>
                </div>
                <TextField label="Fecha recarga *" value={form.recharge_date} onChange={v => setField('recharge_date', v)} type="date" required />
                <TextField label="Vigencia dias" value={form.validity_days} onChange={v => setField('validity_days', v)} type="number" min={1} />
                <TextField label="Avisar dias antes" value={form.alert_days_before} onChange={v => setField('alert_days_before', v)} type="number" min={0} />
                <TextField label="Monto" value={form.amount} onChange={v => setField('amount', v)} type="number" min={0} placeholder="100" />
                <div className="sm:col-span-2 lg:col-span-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)}
                    placeholder="Paquete contratado, folio o comentario..."
                    className="w-full min-h-16 border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="mt-4 rounded-2xl border border-orange-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Recarga real desde plataforma</div>
                    <p className="mt-1 text-xs text-gray-500">
                      Usa el monto y la compania seleccionada. Requiere proveedor/API de tiempo aire configurado.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleTopUp()}
                    disabled={topUpLoading || !device.phone_num}
                    className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    {topUpLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</> : 'Recargar chip'}
                  </button>
                </div>
                {topUpMessage && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {topUpMessage}
                  </div>
                )}
                {!device.phone_num && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Agrega el telefono SIM del chip para poder enviar una recarga real.
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : 'Guardar recarga'}
                </button>
              </div>
            </form>

            <section className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">
                Historial de recargas
              </div>
              {loading ? (
                <div className="py-10 text-center text-sm text-gray-400">Cargando recargas...</div>
              ) : recharges.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Sin recargas registradas</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recharges.map(recharge => {
                    const rowStatus = getSimRechargeStatus(recharge)
                    return (
                      <div key={recharge.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {recharge.carrier} · {new Date(`${recharge.recharge_date}T00:00:00`).toLocaleDateString('es-MX')}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            Vence {new Date(`${recharge.next_recharge_date}T00:00:00`).toLocaleDateString('es-MX')} · vigencia {recharge.validity_days} dias · aviso {recharge.alert_days_before} dias antes
                          </div>
                          {recharge.notes && <div className="mt-1 text-xs text-gray-500">{recharge.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          {recharge.amount != null && (
                            <span className="text-sm font-semibold text-gray-700">
                              ${Number(recharge.amount).toFixed(2)} {recharge.currency}
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${rowStatus.className}`}>
                            {rowStatus.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  maxLength,
  type = 'text',
  min,
  mono = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  maxLength?: number
  type?: string
  min?: number
  mono?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        type={type}
        min={min}
        className={`w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

function StepLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-teal-700">{icon}</span>
      <span>{text}</span>
    </div>
  )
}
