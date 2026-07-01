'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Radio, Wifi, WifiOff, Plus, RefreshCw, Loader2, X, Smartphone,
  Server, Router, ClipboardList, Cpu, ShieldCheck, User, Phone, Mail,
} from 'lucide-react'
import { usePermissions } from '@/lib/context/permissions-context'
import { MobilePermissionSetup } from '@/components/mobile/mobile-permission-setup'

interface Device {
  id: string; imei: string; model: string; firmware_ver: string | null
  sim_iccid: string | null; phone_num: string | null; status: string; last_seen: string | null
  source_type?: string
  mobile_metadata?: Record<string, unknown> | null
  protocol_metadata?: Record<string, unknown> | null
  vehicle: { economic_num: string; plates: string } | null
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

type DeviceSetupMode = 'hardware' | 'mobile'

type ContactSummary = {
  responsible?: string
  emergency?: string
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
}

export default function DevicesPage() {
  const { canWriteFleet, role, companyId } = usePermissions()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch]   = useState('')
  const [filter, setFilter] = useState<'all' | 'hardware' | 'mobile'>('all')
  const needsCompanyPick = role === 'super_admin' && !companyId

  async function loadDevices() {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('source_type', filter)
    const res  = await fetch(`/api/devices?${params}`)
    const data = await res.json()
    setDevices(data.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadDevices() }, [filter])

  const filtered = devices.filter(d =>
    d.imei.includes(search) || d.model.toLowerCase().includes(search.toLowerCase()) ||
    (d.vehicle?.plates ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const mobileNeedingActivation = filtered.find(d => d.source_type === 'mobile' && d.status !== 'online')

  const stats = {
    total:   devices.length,
    online:  devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status !== 'online').length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dispositivos GPS</h1>
          <p className="text-xs text-gray-400 mt-1">
            GPS hardware (Teltonika y más) · Móviles de choferes (opcional en plan flota)
          </p>
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>{stats.total} total</span>
            <span className="text-green-600 font-medium">● {stats.online} en línea</span>
            <span className="text-gray-400">○ {stats.offline} desconectados</span>
          </div>
        </div>
        <div className="flex gap-2">
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
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Dispositivo', 'IMEI', 'SIM', 'Vehículo asignado', 'Estado', 'Última conexión'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No se encontraron dispositivos</td></tr>
              ) : filtered.map(d => {
                const isPendingMobile = d.source_type === 'mobile' && !d.last_seen && d.status !== 'online'
                const cfg = isPendingMobile
                  ? STATUS_STYLES['pending_mobile']!
                  : STATUS_STYLES[d.status] ?? STATUS_STYLES['unknown']!
                const contact = getDeviceContactSummary(d)
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
                          {d.firmware_ver && d.source_type !== 'mobile' && <div className="text-xs text-gray-400">FW: {d.firmware_ver}</div>}
                          {(contact.responsible || contact.emergency) && (
                            <div className="mt-1 text-xs text-gray-500">
                              {contact.responsible && <div>Resp: {contact.responsible}</div>}
                              {contact.emergency && <div>Emerg: {contact.emergency}</div>}
                            </div>
                          )}
                          {d.source_type === 'mobile' && d.status !== 'online' && (
                            <span className="mt-1 inline-flex text-xs font-medium text-orange-600">
                              Reactivar GPS desde el enlace superior
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.imei}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.phone_num ?? d.sim_iccid?.slice(-8) ?? '—'}</td>
                    <td className="px-4 py-3">
                      {d.vehicle
                        ? <span className="text-sm font-medium text-orange-500">{d.vehicle.economic_num} ({d.vehicle.plates})</span>
                        : <span className="text-xs text-gray-400">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border`}
                        style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' }}>
                        {d.status === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{lastSeen}</td>
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

function readContactName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const name = (value as { name?: unknown }).name
  return typeof name === 'string' && name.trim() ? name.trim() : undefined
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
    tracking_interval_sec: '30',
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
  const setContactField = (field: keyof ContactForm, value: string) => setContacts(prev => ({ ...prev, [field]: value }))

  function handleAssignedUserChange(userId: string) {
    setMobileField('assigned_user_id', userId)
    const selectedUser = users.find(user => user.id === userId)
    if (!selectedUser) return
    setContacts(prev => ({
      ...prev,
      responsible_name: prev.responsible_name || selectedUser.full_name,
      responsible_email: prev.responsible_email || selectedUser.email,
    }))
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
      if (mode === 'mobile') {
        if (!mobile.assigned_user_id) throw new Error('Selecciona el usuario que usara este telefono')
        payload = {
          source_type: 'mobile',
          assigned_user_id: mobile.assigned_user_id,
          platform: mobile.platform,
          label: mobile.label.trim() || undefined,
          tracking_interval_sec: Number(mobile.tracking_interval_sec) || 30,
          ...contactPayload,
        }
      } else {
        const finalModel = isCustomModel ? hardware.model_custom.trim() : hardware.model
        if (!finalModel) throw new Error('Escribe el modelo del GPS')
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
            ...contactPayload,
            configured_at: new Date().toISOString(),
          },
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
                    <div className="text-xs text-gray-500">Usuario, plataforma, permisos y enlace de activacion.</div>
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
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Smartphone className="w-4 h-4 text-teal-600" />
                    Movil a activar
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
                    <TextField label="Nombre visible" value={mobile.label} onChange={v => setMobileField('label', v)} placeholder="Telefono de Juan" />
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
                    <TextField label="Intervalo de rastreo (seg)" value={mobile.tracking_interval_sec} onChange={v => setMobileField('tracking_interval_sec', v)} placeholder="30" type="number" min={5} />
                  </div>
                </section>

                <section className="rounded-2xl border border-teal-100 bg-teal-50 p-4 h-fit">
                  <div className="flex items-center gap-2 text-sm font-semibold text-teal-900 mb-3">
                    <ShieldCheck className="w-4 h-4" />
                    Flujo de activacion
                  </div>
                  <div className="space-y-3 text-sm text-teal-900">
                    <StepLine icon={<User className="w-4 h-4" />} text="Se crea el movil ligado al usuario seleccionado." />
                    <StepLine icon={<Smartphone className="w-4 h-4" />} text="El usuario abre /descargar en ese telefono e inicia sesion." />
                    <StepLine icon={<Router className="w-4 h-4" />} text="TrackPro solicita ubicacion y permisos internos una sola vez." />
                    <StepLine icon={<Wifi className="w-4 h-4" />} text="La primera telemetria lo mostrara en mapa como movil/persona." />
                  </div>
                </section>
              </div>
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
                      <TextField label="Nombre responsable *" value={contacts.responsible_name} onChange={v => setContactField('responsible_name', v)} placeholder="Luis Alfonso Perez Avilez" required />
                    </div>
                    <TextField label="Celular responsable *" value={contacts.responsible_phone} onChange={v => setContactField('responsible_phone', v)} placeholder="6674912221" required />
                    <TextField label="Correo responsable" value={contacts.responsible_email} onChange={v => setContactField('responsible_email', v)} placeholder="correo del admin" type="email" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <Phone className="w-4 h-4" />
                    Contacto de emergencia
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <TextField label="Nombre emergencia *" value={contacts.emergency_name} onChange={v => setContactField('emergency_name', v)} placeholder="Carolina Banuelos Angulo" required />
                    </div>
                    <TextField label="Celular emergencia *" value={contacts.emergency_phone} onChange={v => setContactField('emergency_phone', v)} placeholder="6674157137" required />
                    <TextField label="Correo emergencia" value={contacts.emergency_email} onChange={v => setContactField('emergency_email', v)} placeholder="cabaan2014@gmail.com" type="email" />
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
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando...</> : mode === 'mobile' ? 'Preparar movil' : 'Registrar GPS'}
            </button>
          </div>
        </form>
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
