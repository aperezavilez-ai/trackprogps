'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Check, Loader2, User, Truck, Radio, MapPin, ClipboardCheck,
} from 'lucide-react'
import { DEVICE_MODEL_GROUPS, DEFAULT_DEVICE_MODEL } from '@/lib/device-models'

interface GeofenceOption {
  id: string
  name: string
  is_active: boolean
  vehicle_ids: string[] | null
}

interface VehicleGroup {
  id: string
  name: string
}

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Automóvil' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Camión' },
  { value: 'motorcycle', label: 'Motocicleta' },
  { value: 'other', label: 'Otro' },
]

const STEPS_FULL = [
  { id: 1, label: 'Cliente', icon: User },
  { id: 2, label: 'Vehículo', icon: Truck },
  { id: 3, label: 'GPS', icon: Radio },
  { id: 4, label: 'Geocercas', icon: MapPin },
  { id: 5, label: 'Confirmar', icon: ClipboardCheck },
]

const STEPS_ADD_UNIT = [
  { id: 2, label: 'Vehículo', icon: Truck },
  { id: 3, label: 'GPS', icon: Radio },
  { id: 4, label: 'Geocercas', icon: MapPin },
  { id: 5, label: 'Confirmar', icon: ClipboardCheck },
]

interface Props {
  mode: 'full' | 'add-unit'
  driverId?: string
  driverName?: string
}

export function InstallationWizard({ mode, driverId, driverName }: Props) {
  const router = useRouter()
  const steps = mode === 'full' ? STEPS_FULL : STEPS_ADD_UNIT
  const [step, setStep] = useState(mode === 'full' ? 1 : 2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accountType, setAccountType] = useState('business')
  const [groups, setGroups] = useState<VehicleGroup[]>([])
  const [geofences, setGeofences] = useState<GeofenceOption[]>([])

  const [driver, setDriver] = useState({
    full_name: driverName ?? '',
    phone: '',
    email: '',
    license_num: '',
    license_exp: '',
    notes: '',
  })

  const [vehicle, setVehicle] = useState({
    economic_num: '',
    plates: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    type: 'sedan',
    color: '',
    max_speed: 120,
    group_id: '',
    owner_name: driverName ?? '',
  })

  const [device, setDevice] = useState({
    imei: '',
    model: DEFAULT_DEVICE_MODEL,
    model_custom: '',
    sim_iccid: '',
    phone_num: '',
    firmware_ver: '',
  })

  const [geoConfig, setGeoConfig] = useState({
    enabled: false,
    assignExisting: true,
    selectedIds: [] as string[],
    createNew: false,
    newName: 'Casa / Taller',
    newLat: '19.4326',
    newLng: '-99.1332',
    newRadius: 500,
  })

  const licenseRequired = accountType === 'business'
  const isCustomModel = device.model === 'Otro'

  useEffect(() => {
    fetch('/api/vehicle-groups')
      .then(r => r.json())
      .then(json => {
        setGroups(json.data ?? [])
        setAccountType(json.account_type ?? 'business')
        const def = json.data?.find((g: VehicleGroup & { is_default?: boolean }) => g.is_default) ?? json.data?.[0]
        if (def) setVehicle(v => ({ ...v, group_id: def.id }))
      })
      .catch(() => {})

    fetch('/api/geofences?active=true')
      .then(r => r.json())
      .then(json => setGeofences(json.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (mode === 'full' && driver.full_name && !vehicle.owner_name) {
      setVehicle(v => ({ ...v, owner_name: driver.full_name }))
    }
  }, [driver.full_name, mode, vehicle.owner_name])

  function setDriverField(f: string, v: string) {
    setDriver(p => ({ ...p, [f]: v }))
  }

  function setVehicleField(f: string, v: string | number) {
    setVehicle(p => ({ ...p, [f]: v }))
  }

  function setDeviceField(f: string, v: string) {
    setDevice(p => ({ ...p, [f]: v }))
  }

  function toggleGeofence(id: string) {
    setGeoConfig(p => ({
      ...p,
      selectedIds: p.selectedIds.includes(id)
        ? p.selectedIds.filter(x => x !== id)
        : [...p.selectedIds, id],
    }))
  }

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!driver.full_name.trim()) return 'Nombre del cliente es obligatorio'
      if (licenseRequired && (!driver.license_num || !driver.license_exp)) {
        return 'Licencia y vencimiento son obligatorios'
      }
    }
    if (s === 2) {
      if (!vehicle.economic_num.trim()) return 'Número económico / alias es obligatorio'
      if (!vehicle.plates.trim()) return 'Placas son obligatorias'
      if (!vehicle.brand.trim() || !vehicle.model.trim()) return 'Marca y modelo son obligatorios'
    }
    if (s === 3) {
      if (!/^\d{15}$/.test(device.imei)) return 'IMEI debe tener 15 dígitos'
      if (isCustomModel && !device.model_custom.trim()) return 'Indica el modelo del GPS'
    }
    if (s === 4 && geoConfig.createNew) {
      if (!geoConfig.newName.trim()) return 'Nombre de geocerca requerido'
      if (!geoConfig.newLat || !geoConfig.newLng) return 'Latitud y longitud requeridas'
    }
    return null
  }

  function nextStep() {
    const err = validateStep(step)
    if (err) { setError(err); return }
    setError('')
    setStep(s => Math.min(s + 1, 5))
  }

  function prevStep() {
    setError('')
    const minStep = mode === 'full' ? 1 : 2
    setStep(s => Math.max(s - 1, minStep))
  }

  async function handleSubmit() {
    const err = validateStep(3)
    if (err) { setError(err); setStep(3); return }

    setLoading(true)
    setError('')

    try {
      const payload: Record<string, unknown> = {
        vehicle: {
          ...vehicle,
          year: Number(vehicle.year),
          max_speed: Number(vehicle.max_speed),
          group_id: vehicle.group_id || null,
          owner_name: vehicle.owner_name || driver.full_name || null,
        },
        device: {
          imei: device.imei,
          model: isCustomModel ? device.model_custom.trim() : device.model,
          sim_iccid: device.sim_iccid || null,
          phone_num: device.phone_num || null,
          firmware_ver: device.firmware_ver || null,
        },
      }

      if (mode === 'add-unit' && driverId) {
        payload.driver_id = driverId
      } else {
        payload.driver = {
          ...driver,
          phone: driver.phone || null,
          email: driver.email || null,
          license_num: driver.license_num || null,
          license_exp: driver.license_exp || null,
          notes: driver.notes || null,
        }
      }

      if (geoConfig.enabled && geoConfig.assignExisting && geoConfig.selectedIds.length) {
        payload.geofence_ids = geoConfig.selectedIds
      }

      if (geoConfig.enabled && geoConfig.createNew) {
        payload.new_geofence = {
          name: geoConfig.newName,
          type: 'circular',
          lat: parseFloat(geoConfig.newLat),
          lng: parseFloat(geoConfig.newLng),
          radius_m: geoConfig.newRadius,
          color: '#3B82F6',
          alert_on_enter: true,
          alert_on_exit: true,
        }
      }

      const res = await fetch('/api/clients/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al completar instalación')

      router.push(`/drivers/${data.data.driver_id}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const economicLabel = accountType === 'business' ? 'Número económico *' : 'Nombre / alias del vehículo *'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href={mode === 'add-unit' && driverId ? `/drivers/${driverId}` : '/drivers'}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {mode === 'full' ? 'Nueva instalación' : `Agregar unidad — ${driverName}`}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'full'
            ? 'Registra cliente, vehículo, GPS y geocercas en un solo flujo'
            : 'Instala un nuevo GPS para este cliente'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon
          const active = step === s.id
          const done = step > s.id
          return (
            <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition ${
                active ? 'bg-blue-600 text-white' : done ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                {s.label}
              </div>
              {i < steps.length - 1 && <div className="w-4 h-px bg-gray-200" />}
            </div>
          )
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos del cliente</h2>
            {[
              { label: 'Nombre completo *', field: 'full_name', type: 'text', placeholder: 'Juan García López' },
              { label: 'Teléfono', field: 'phone', type: 'tel', placeholder: '+52 55 1234 5678' },
              { label: 'Correo electrónico', field: 'email', type: 'email', placeholder: 'cliente@email.com' },
              { label: licenseRequired ? 'Número de licencia *' : 'Número de licencia', field: 'license_num', type: 'text', placeholder: 'MX-A-123456' },
              { label: licenseRequired ? 'Vencimiento de licencia *' : 'Vencimiento de licencia', field: 'license_exp', type: 'date', placeholder: '' },
            ].map(({ label, field, type, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={(driver as Record<string, string>)[field] ?? ''}
                  onChange={e => setDriverField(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
              <textarea
                value={driver.notes}
                onChange={e => setDriverField('notes', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehículo / Unidad</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{economicLabel}</label>
                <input required value={vehicle.economic_num} onChange={e => setVehicleField('economic_num', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Placas *</label>
                <input required value={vehicle.plates} onChange={e => setVehicleField('plates', e.target.value.toUpperCase())}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Titular</label>
                <input value={vehicle.owner_name} onChange={e => setVehicleField('owner_name', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo / Flotilla</label>
                <select value={vehicle.group_id} onChange={e => setVehicleField('group_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Marca *</label>
                <input required value={vehicle.brand} onChange={e => setVehicleField('brand', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo *</label>
                <input required value={vehicle.model} onChange={e => setVehicleField('model', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Año *</label>
                <input type="number" required value={vehicle.year} onChange={e => setVehicleField('year', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
                <select value={vehicle.type} onChange={e => setVehicleField('type', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vel. máxima (alertas)</label>
                <input type="number" value={vehicle.max_speed} onChange={e => setVehicleField('max_speed', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dispositivo GPS</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">IMEI (15 dígitos) *</label>
              <input required value={device.imei} onChange={e => setDeviceField('imei', e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="123456789012345"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo *</label>
              <select value={device.model} onChange={e => setDeviceField('model', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {DEVICE_MODEL_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                ))}
              </select>
              {isCustomModel && (
                <input value={device.model_custom} onChange={e => setDeviceField('model_custom', e.target.value)}
                  placeholder="Modelo exacto" required
                  className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ICCID SIM</label>
                <input value={device.sim_iccid} onChange={e => setDeviceField('sim_iccid', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono SIM</label>
                <input value={device.phone_num} onChange={e => setDeviceField('phone_num', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Geocercas (opcional)</h2>
            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={geoConfig.enabled}
                onChange={e => setGeoConfig(p => ({ ...p, enabled: e.target.checked }))}
                className="rounded" />
              <span className="text-sm text-gray-700">Configurar geocercas para esta unidad</span>
            </label>

            {geoConfig.enabled && (
              <>
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Asignar geocercas existentes</p>
                  {geofences.length === 0 ? (
                    <p className="text-xs text-gray-400">No hay geocercas activas. Puedes crear una nueva abajo.</p>
                  ) : geofences.map(f => (
                    <label key={f.id} className="flex items-center gap-3 text-sm cursor-pointer">
                      <input type="checkbox" checked={geoConfig.selectedIds.includes(f.id)}
                        onChange={() => toggleGeofence(f.id)} className="rounded" />
                      <span>{f.name}</span>
                      <span className="text-xs text-gray-400">
                        {f.vehicle_ids === null ? 'Toda la flota' : `${f.vehicle_ids.length} vehículo(s)`}
                      </span>
                    </label>
                  ))}
                </div>

                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={geoConfig.createNew}
                    onChange={e => setGeoConfig(p => ({ ...p, createNew: e.target.checked }))}
                    className="rounded" />
                  <span className="text-sm text-gray-700">Crear geocerca nueva (circular)</span>
                </label>

                {geoConfig.createNew && (
                  <div className="grid grid-cols-2 gap-4 pl-2">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                      <input value={geoConfig.newName} onChange={e => setGeoConfig(p => ({ ...p, newName: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Latitud</label>
                      <input value={geoConfig.newLat} onChange={e => setGeoConfig(p => ({ ...p, newLat: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Longitud</label>
                      <input value={geoConfig.newLng} onChange={e => setGeoConfig(p => ({ ...p, newLng: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Radio: {geoConfig.newRadius} m
                      </label>
                      <input type="range" min={50} max={5000} step={50} value={geoConfig.newRadius}
                        onChange={e => setGeoConfig(p => ({ ...p, newRadius: parseInt(e.target.value) }))}
                        className="w-full" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen de instalación</h2>
            <dl className="space-y-3 text-sm">
              {mode === 'full' && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <dt className="text-gray-500 text-xs uppercase mb-1">Cliente</dt>
                  <dd className="font-semibold">{driver.full_name}</dd>
                  <dd className="text-gray-600">{driver.phone || driver.email || '—'}</dd>
                </div>
              )}
              <div className="p-4 bg-gray-50 rounded-xl">
                <dt className="text-gray-500 text-xs uppercase mb-1">Vehículo</dt>
                <dd className="font-semibold">{vehicle.economic_num} · {vehicle.plates}</dd>
                <dd className="text-gray-600">{vehicle.brand} {vehicle.model} ({vehicle.year})</dd>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <dt className="text-gray-500 text-xs uppercase mb-1">GPS</dt>
                <dd className="font-semibold">{isCustomModel ? device.model_custom : device.model}</dd>
                <dd className="font-mono text-gray-600">{device.imei}</dd>
              </div>
              {geoConfig.enabled && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <dt className="text-gray-500 text-xs uppercase mb-1">Geocercas</dt>
                  <dd>
                    {geoConfig.selectedIds.length > 0 && `${geoConfig.selectedIds.length} existente(s)`}
                    {geoConfig.selectedIds.length > 0 && geoConfig.createNew && ' + '}
                    {geoConfig.createNew && `Nueva: ${geoConfig.newName}`}
                    {!geoConfig.selectedIds.length && !geoConfig.createNew && 'Ninguna'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          {step > (mode === 'full' ? 1 : 2) && (
            <button type="button" onClick={prevStep}
              className="flex items-center gap-2 px-5 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Anterior
            </button>
          )}
          <div className="flex-1" />
          {step < 5 ? (
            <button type="button" onClick={nextStep}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Instalando...</> : 'Finalizar instalación'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
