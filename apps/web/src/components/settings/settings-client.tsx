'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, UserPlus, Trash2 } from 'lucide-react'

const TABS = ['Empresa', 'Usuarios', 'Notificaciones', 'Reglas de alerta'] as const
type Tab = typeof TABS[number]

const ROLE_OPTIONS = [
  { value: 'admin_empresa',    label: 'Administrador' },
  { value: 'supervisor',       label: 'Supervisor' },
  { value: 'operador',         label: 'Operador' },
  { value: 'cliente_consulta', label: 'Solo consulta' },
]

interface Profile {
  full_name: string; email: string; phone: string | null; role: string
  company: {
    id: string; name: string; rfc: string | null; phone: string | null; email: string
    address: string | null; settings: Record<string, unknown>
  } | null
}

interface TeamMember { id: string; full_name: string; email: string; role: string; is_active: boolean; created_at: string }

export function SettingsClient({ profile, teamMembers }: { profile: Profile | null; teamMembers: TeamMember[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('Empresa')

  return (
    <div className="max-w-3xl">
      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Empresa' && <CompanySettings profile={profile} onSave={() => router.refresh()} />}
      {tab === 'Usuarios' && <UsersSettings teamMembers={teamMembers} onSave={() => router.refresh()} />}
      {tab === 'Notificaciones' && <NotificationSettings profile={profile} />}
      {tab === 'Reglas de alerta' && <AlertRulesSettings />}
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
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      ))}
      <div className="flex justify-end">
        <button type="submit" disabled={loading}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition
            ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : saved ? '✓ Guardado' : <><Save className="w-4 h-4" /> Guardar cambios</>}
        </button>
      </div>
    </form>
  )
}

function UsersSettings({ teamMembers, onSave }: { teamMembers: TeamMember[]; onSave: () => void }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('operador')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/settings/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al invitar')
      setInviteEmail('')
      onSave()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
    finally { setLoading(false) }
  }

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin', admin_empresa: 'Administrador',
    supervisor: 'Supervisor', operador: 'Operador', cliente_consulta: 'Solo consulta',
  }

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Invitar usuario</h2>
        <form onSubmit={handleInvite} className="flex gap-3 flex-wrap">
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            required placeholder="correo@empresa.com"
            className="flex-1 min-w-48 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invitar
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Team list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Miembros del equipo ({teamMembers.length})</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {teamMembers.map(m => (
            <div key={m.id} className="flex items-center gap-4 px-6 py-4">
              <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                {m.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{m.full_name}</div>
                <div className="text-xs text-gray-500">{m.email}</div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium
                ${m.role === 'admin_empresa' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
              <span className={`w-2 h-2 rounded-full ${m.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationSettings({ profile }: { profile: Profile | null }) {
  const [form, setForm] = useState({
    notification_email: (profile?.company?.settings as Record<string, string>)?.['notification_email'] ?? '',
    notification_phone: (profile?.company?.settings as Record<string, string>)?.['notification_phone'] ?? '',
    whatsapp_phone:     (profile?.company?.settings as Record<string, string>)?.['whatsapp_phone'] ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

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
      <p className="text-sm text-gray-500">Define a qué contactos llegan las alertas de la flota.</p>
      {[
        { label: 'Email de alertas', field: 'notification_email', type: 'email', placeholder: 'alertas@empresa.com' },
        { label: 'WhatsApp (número con código de país)', field: 'whatsapp_phone', type: 'tel', placeholder: '+525512345678' },
      ].map(({ label, field, type, placeholder }) => (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
          <input type={type} value={(form as Record<string, string>)[field]} onChange={e => set(field, e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      ))}
      <div className="flex justify-end">
        <button type="submit" disabled={loading}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} text-white disabled:opacity-60`}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : saved ? '✓ Guardado' : <><Save className="w-4 h-4" /> Guardar</>}
        </button>
      </div>
    </form>
  )
}

function AlertRulesSettings() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Reglas de alerta</h2>
      <p className="text-sm text-gray-500">Configura qué eventos generan alertas y por qué canales se envían.</p>
      <div className="mt-4 text-center py-8 text-gray-400 text-sm">
        Módulo de reglas de alerta — disponible en plan Profesional y superior
      </div>
    </div>
  )
}
