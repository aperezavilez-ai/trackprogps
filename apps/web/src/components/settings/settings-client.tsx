'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'
import { AlertRulesPanel } from '@/components/settings/alert-rules-panel'
import { UsersAdminPanel } from '@/components/admin/users-admin-panel'
import { VehicleGroupsPanel } from '@/components/fleet/vehicle-groups-panel'
import { canManageGroups, canManageUsers, canManageBilling } from '@/lib/auth/permissions'

const ALL_TABS = ['Empresa', 'Grupos', 'Facturación CFDI', 'Usuarios', 'Notificaciones', 'Reglas de alerta'] as const
type Tab = typeof ALL_TABS[number]

interface Profile {
  id?: string
  full_name: string; email: string; phone: string | null; role: string
  company: {
    id: string; name: string; rfc: string | null; phone: string | null; email: string
    address: string | null; settings: Record<string, unknown>
  } | null
}

interface TeamMember { id: string; full_name: string; email: string; role: string; is_active: boolean; created_at: string }

export function SettingsClient({ profile, currentUserId }: {
  profile: Profile | null
  teamMembers?: TeamMember[]
  currentUserId: string
}) {
  const router = useRouter()
  const role = profile?.role ?? 'operador'
  const tabs = ALL_TABS.filter(t => {
    if (t === 'Usuarios' && !canManageUsers(role)) return false
    if (t === 'Grupos' && !canManageGroups(role)) return false
    if ((t === 'Facturación CFDI' || t === 'Empresa') && !canManageBilling(role) && role !== 'super_admin') {
      if (t === 'Facturación CFDI') return false
    }
    if (t === 'Notificaciones' && !canManageBilling(role)) return false
    if (t === 'Reglas de alerta' && !canManageGroups(role)) return false
    if (role === 'miembro_familiar') return false
    return true
  })
  const [tab, setTab] = useState<Tab>(tabs[0] ?? 'Empresa')
  const accountType = (profile?.company as { account_type?: string } | undefined)?.account_type ?? 'business'

  if (tabs.length === 0) {
    return (
      <div className="max-w-5xl">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-600">Hola, <strong>{profile?.full_name}</strong></p>
          <p className="text-xs text-gray-400 mt-2">Tu cuenta es de solo lectura. Contacta al administrador para cambios.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Empresa' && <CompanySettings profile={profile} onSave={() => router.refresh()} />}
      {tab === 'Grupos' && (
        <VehicleGroupsPanel canEdit={canManageGroups(role)} accountType={accountType} />
      )}
      {tab === 'Facturación CFDI' && <BillingCfdiSettings profile={profile} onSave={() => router.refresh()} />}
      {tab === 'Usuarios' && (
        <UsersAdminPanel
          currentUserId={currentUserId}
          isSuperAdmin={profile?.role === 'super_admin'}
          defaultCompanyId={profile?.company?.id}
          showCompanyFilter={profile?.role === 'super_admin'}
        />
      )}
      {tab === 'Notificaciones' && <NotificationSettings profile={profile} />}
      {tab === 'Reglas de alerta' && <AlertRulesPanel />}
    </div>
  )
}

function CompanySettings({ profile, onSave }: { profile: Profile | null; onSave: () => void }) {
  const company = profile?.company
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [form, setForm]       = useState({
    name:    company?.name ?? '',
    rfc:     company?.rfc ?? '',
    phone:   company?.phone ?? '',
    email:   company?.email ?? '',
    address: company?.address ?? '',
  })
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/settings/company', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setLoading(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    onSave()
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Datos de la empresa</h2>
      {[
        { label: 'Nombre de la empresa', field: 'name', type: 'text', required: true },
        { label: 'RFC', field: 'rfc', type: 'text' },
        { label: 'Teléfono', field: 'phone', type: 'tel' },
        { label: 'Correo de contacto', field: 'email', type: 'email', required: true },
        { label: 'Dirección', field: 'address', type: 'text' },
      ].map(({ label, field, type, required }) => (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && ' *'}</label>
          <input type={type} value={(form as Record<string, string>)[field]} onChange={e => set(field, e.target.value)}
            required={required}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      ))}
      <div className="flex justify-end">
        <button type="submit" disabled={loading}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition
            ${saved ? 'bg-green-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'} disabled:opacity-60`}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : saved ? '✓ Guardado' : <><Save className="w-4 h-4" /> Guardar cambios</>}
        </button>
      </div>
    </form>
  )
}

function NotificationSettings({ profile }: { profile: Profile | null }) {
  const [form, setForm] = useState({
    notification_email: (profile?.company?.settings as Record<string, string>)?.['notification_email'] ?? profile?.company?.email ?? '',
    notification_email_secondary: (profile?.company?.settings as Record<string, string>)?.['notification_email_secondary'] ?? '',
    notification_phone: (profile?.company?.settings as Record<string, string>)?.['notification_phone'] ?? '',
    whatsapp_phone:     (profile?.company?.settings as Record<string, string>)?.['whatsapp_phone'] ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testMsg, setTestMsg]       = useState('')
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function sendTestEmail() {
    setTestLoading(true)
    setTestMsg('')
    try {
      const res = await fetch('/api/settings/test-notification', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setTestMsg(json.error ?? 'Error al enviar')
      else setTestMsg(`✓ Enviado a ${json.sent_to}`)
    } finally {
      setTestLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await fetch('/api/settings/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setLoading(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Canales de notificación</h2>
      <p className="text-sm text-gray-500">Las alertas se envían a ambos correos si son distintos.</p>
      {[
        { label: 'Email principal de alertas', field: 'notification_email', type: 'email', placeholder: 'alertas@empresa.com' },
        { label: 'Email secundario (acceso / admin)', field: 'notification_email_secondary', type: 'email', placeholder: 'admin@empresa.com' },
        { label: 'Teléfono SMS (opcional)', field: 'notification_phone', type: 'tel', placeholder: '+525512345678' },
        { label: 'WhatsApp (número con código de país)', field: 'whatsapp_phone', type: 'tel', placeholder: '+525512345678' },
      ].map(({ label, field, type, placeholder }) => (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
          <input type={type} value={(form as Record<string, string>)[field]} onChange={e => set(field, e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      ))}
      {testMsg && <p className={`text-sm ${testMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{testMsg}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={sendTestEmail}
          disabled={testLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {testLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Probar email'}
        </button>
        <button type="submit" disabled={loading}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium ${saved ? 'bg-green-600' : 'bg-orange-500 hover:bg-orange-600'} text-white disabled:opacity-60`}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : saved ? '✓ Guardado' : <><Save className="w-4 h-4" /> Guardar</>}
        </button>
      </div>
    </form>
  )
}

function BillingCfdiSettings({ profile, onSave }: { profile: Profile | null; onSave: () => void }) {
  const company = profile?.company
  const existing = (company?.settings as Record<string, unknown> | undefined)?.['billing_cfdi'] as Record<string, string> | undefined
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [form, setForm] = useState({
    razon_social:    existing?.razon_social ?? company?.name ?? '',
    rfc:             existing?.rfc ?? company?.rfc ?? '',
    regimen_fiscal:  existing?.regimen_fiscal ?? '601',
    codigo_postal:   existing?.codigo_postal ?? '',
    serie_factura:   existing?.serie_factura ?? 'A',
    folio_inicial:   existing?.folio_inicial ?? '1',
    pac_provider:    existing?.pac_provider ?? '',
    pac_api_key:     existing?.pac_api_key ?? '',
    uso_cfdi:        existing?.uso_cfdi ?? 'G03',
  })
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/settings/billing-cfdi', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    onSave()
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Datos de facturación CFDI</h2>
      <p className="text-sm text-gray-500">
        Estos datos se usan en Facturación para timbrar con el SAT (QR, cadena, UUID). Sube tu CSD en tu PAC.
      </p>
      {[
        { label: 'Razón social *', field: 'razon_social' },
        { label: 'RFC *', field: 'rfc' },
        { label: 'Régimen fiscal (ej. 601)', field: 'regimen_fiscal' },
        { label: 'Código postal *', field: 'codigo_postal' },
        { label: 'Uso CFDI (ej. G03)', field: 'uso_cfdi' },
        { label: 'Serie de factura', field: 'serie_factura' },
        { label: 'Folio inicial', field: 'folio_inicial' },
        { label: 'Proveedor PAC (Facturama, SW, etc.)', field: 'pac_provider' },
        { label: 'API Key del PAC', field: 'pac_api_key' },
      ].map(({ label, field }) => (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
          <input value={form[field as keyof typeof form]} onChange={e => set(field, e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      ))}
      <div className="flex justify-end">
        <button type="submit" disabled={loading}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium ${saved ? 'bg-green-600' : 'bg-orange-500 hover:bg-orange-600'} text-white disabled:opacity-60`}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : saved ? '✓ Guardado' : <><Save className="w-4 h-4" /> Guardar</>}
        </button>
      </div>
    </form>
  )
}
