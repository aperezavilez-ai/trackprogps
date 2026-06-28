'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Loader2, Shield, Trash2, Mail, KeyRound } from 'lucide-react'
import { isInternalTeamRole } from '@/lib/auth/platform-team'

export interface AdminUser {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  last_sign_in_at: string | null
  company: { id: string; name: string } | null
  group_access?: Array<{ id: string; name: string; color: string }>
}

interface VehicleGroup { id: string; name: string; color: string }

const ROLE_OPTIONS = [
  { value: 'super_admin',      label: 'Dueño plataforma',     desc: 'Acceso total — gestiona empresas, facturación e ingresos' },
  { value: 'admin_empresa',    label: 'Administrador interno', desc: 'Equipo TrackPro — operación y soporte' },
  { value: 'supervisor',       label: 'Supervisor interno',   desc: 'Equipo TrackPro — monitoreo y reportes' },
  { value: 'operador',         label: 'Operador interno',     desc: 'Equipo TrackPro — monitoreo y alertas' },
  { value: 'cliente_consulta', label: 'Solo consulta',        desc: 'Solo lectura (empresa cliente)' },
  { value: 'miembro_familiar', label: 'Miembro familiar',     desc: 'Solo vehículos de sus grupos' },
]

const PLATFORM_INVITE_ROLES = ROLE_OPTIONS.filter(r =>
  ['super_admin', 'admin_empresa', 'supervisor', 'operador'].includes(r.value),
)

const COMPANY_INVITE_ROLES = ROLE_OPTIONS.filter(r => r.value !== 'super_admin')

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map(r => [r.value, r.label])
)

const ROLE_COLORS: Record<string, string> = {
  super_admin:      'bg-orange-50 text-orange-700 border-orange-200',
  admin_empresa:    'bg-purple-50 text-purple-700 border-purple-200',
  supervisor:       'bg-orange-50 text-orange-600 border-orange-200',
  operador:         'bg-gray-50 text-gray-600 border-gray-200',
  miembro_familiar: 'bg-teal-50 text-teal-700 border-teal-200',
}

interface Props {
  currentUserId: string
  isSuperAdmin: boolean
  defaultCompanyId?: string
  /** platform = equipo interno TrackPro; company = staff de una empresa cliente */
  variant?: 'platform' | 'company'
}

export function UsersAdminPanel({
  currentUserId,
  isSuperAdmin,
  defaultCompanyId,
  variant = isSuperAdmin ? 'platform' : 'company',
}: Props) {
  const isPlatformTeam = variant === 'platform'
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState(isPlatformTeam ? 'admin_empresa' : 'operador')
  const [inviteGroups, setInviteGroups] = useState<string[]>([])
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([])
  const [accountType, setAccountType] = useState('business')
  const [inviting, setInviting]     = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [savingId, setSavingId]     = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (isPlatformTeam) params.set('scope', 'internal')
    const res = await fetch(`/api/users?${params}`)
    const data = await res.json()
    setUsers(data.data ?? [])
    setLoading(false)
  }, [isPlatformTeam])

  useEffect(() => {
    fetch('/api/vehicle-groups')
      .then(r => r.json())
      .then(d => {
        setVehicleGroups(d.data ?? [])
        setAccountType(d.account_type ?? 'business')
        if (d.account_type === 'family') setInviteRole('miembro_familiar')
      })
      .catch(() => {})
  }, [])

  useEffect(() => { void loadUsers() }, [loadUsers])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (isPlatformTeam && inviteRole !== 'super_admin' && !isInternalTeamRole(inviteRole)) {
      setError('Rol no válido para equipo interno.')
      return
    }

    setInviting(true)
    try {
      const body: Record<string, unknown> = {
        email: inviteEmail.trim(),
        role: inviteRole,
        scope: isPlatformTeam ? 'internal' : 'company',
      }
      if (showGroupPicker && inviteGroups.length) body.group_ids = inviteGroups
      const res = await fetch('/api/settings/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al invitar')
      setInviteEmail('')
      setInviteGroups([])
      setSuccess(data.message ?? `Invitación enviada a ${body.email}`)
      void loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al dar de alta')
    } finally {
      setInviting(false)
    }
  }

  async function updateUser(id: string, updates: { role?: string; is_active?: boolean; group_ids?: string[] }) {
    setSavingId(id)
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error ?? 'Error al actualizar')
    } else {
      void loadUsers()
    }
    setSavingId(null)
  }

  async function resendAccess(id: string, type: 'activation' | 'reset') {
    setResendingId(`${id}:${type}`)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/users/${id}/resend-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar correo')
      setSuccess(data.message ?? 'Correo enviado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar correo')
    } finally {
      setResendingId(null)
    }
  }

  async function removeUser(id: string, name: string) {
    if (!confirm(`¿Desactivar acceso de ${name}?`)) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error ?? 'Error al quitar usuario')
    } else {
      void loadUsers()
    }
  }

  const assignableRoles = isPlatformTeam
    ? PLATFORM_INVITE_ROLES
    : isSuperAdmin
      ? ROLE_OPTIONS
      : COMPANY_INVITE_ROLES

  const showGroupPicker = ['personal', 'family'].includes(accountType)
    && ['operador', 'cliente_consulta', 'miembro_familiar'].includes(inviteRole)

  function toggleInviteGroup(id: string) {
    setInviteGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  function toggleUserGroup(userId: string, current: string[], groupId: string) {
    const next = current.includes(groupId)
      ? current.filter(g => g !== groupId)
      : [...current, groupId]
    void updateUser(userId, { group_ids: next })
  }

  return (
    <div className="space-y-6">
      {/* Invitar */}
      <div id="alta-usuario" className="bg-white border border-gray-200 rounded-2xl p-6 scroll-mt-24">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-semibold text-gray-900">
            {isPlatformTeam ? 'Dar de alta — equipo interno TrackPro' : 'Dar de alta usuario'}
          </h2>
        </div>
        {isPlatformTeam ? (
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            Solo personal de <strong>TrackPro GPS</strong>. Recibirán un correo para{' '}
            <strong>activar la cuenta y crear su contraseña</strong>.
            Los clientes se registran en{' '}
            <a href="/register" className="text-orange-500 hover:underline">trackprogps.mx/register</a>.
          </p>
        ) : (
          <p className="text-sm text-gray-600 mb-4">
            Invita colaboradores de tu empresa. Recibirán un correo con enlace para <strong>activar la cuenta y crear su contraseña</strong> (no enviamos contraseñas por email).
          </p>
        )}
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            required placeholder="correo@trackprogps.mx"
            className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 sm:col-span-1 lg:col-span-1" />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {assignableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" disabled={inviting}
            className="flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Dar de alta
          </button>
          </div>

          {showGroupPicker && vehicleGroups.length > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs font-medium text-orange-800 mb-2">
                Grupos visibles — el miembro solo verá vehículos de estos grupos
              </p>
              <div className="flex flex-wrap gap-2">
                {vehicleGroups.map(g => (
                  <label key={g.id} className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:border-orange-300">
                    <input
                      type="checkbox"
                      checked={inviteGroups.includes(g.id)}
                      onChange={() => toggleInviteGroup(g.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{success}</p>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Enlace de activación por correo · Recuperación con «Olvidé mi contraseña» · Reenviar desde la lista de usuarios.
        </p>
      </div>

      {/* Permisos por rol */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Permisos por rol</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(isPlatformTeam ? PLATFORM_INVITE_ROLES : ROLE_OPTIONS).map(r => (
            <div key={r.value} className="text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
              <span className="font-medium text-gray-800">{r.label}</span>
              <span className="text-gray-400 ml-1">— {r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {isPlatformTeam ? 'Equipo interno TrackPro' : 'Usuarios'} ({users.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No hay usuarios registrados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map(u => {
              const isSelf = u.id === currentUserId
              const isSaving = savingId === u.id
              return (
                <div key={u.id} className={`flex flex-wrap items-center gap-4 px-6 py-4 ${!u.is_active ? 'opacity-50' : ''}`}>
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                    {u.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {u.full_name}
                      {isSelf && <span className="text-xs text-orange-500">(tú)</span>}
                      {!u.is_active && <span className="text-xs text-red-500">Inactivo</span>}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                    {u.last_sign_in_at ? (
                      <div className="text-[10px] text-green-600 mt-0.5">Cuenta activada</div>
                    ) : (
                      <div className="text-[10px] text-amber-600 mt-0.5">Pendiente de activación</div>
                    )}
                    {u.company && <div className="text-xs text-gray-400 mt-0.5">{u.company.name}</div>}
                    {u.group_access && u.group_access.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {u.group_access.map(g => (
                          <span key={g.id} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cambiar rol */}
                  <select
                    value={u.role}
                    disabled={isSelf || isSaving || (!isSuperAdmin && u.role === 'super_admin')}
                    onChange={e => updateUser(u.id, { role: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  >
                    {assignableRoles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                    {!isSuperAdmin && u.role === 'super_admin' && (
                      <option value="super_admin">Dueño plataforma</option>
                    )}
                  </select>

                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-50 text-gray-600'}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>

                  {showGroupPicker && !isSelf && ['operador', 'cliente_consulta', 'miembro_familiar'].includes(u.role) && vehicleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {vehicleGroups.map(g => {
                        const selected = (u.group_access ?? []).some(ga => ga.id === g.id)
                        return (
                          <button
                            key={g.id}
                            type="button"
                            disabled={isSaving}
                            onClick={() => toggleUserGroup(u.id, (u.group_access ?? []).map(ga => ga.id), g.id)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition disabled:opacity-40
                              ${selected ? 'bg-orange-50 border-orange-300 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                          >
                            {g.name}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Reenviar activación / restablecer */}
                  {!isSelf && (
                    <div className="flex flex-col gap-1">
                      {!u.last_sign_in_at && (
                        <button
                          type="button"
                          disabled={isSaving || resendingId === `${u.id}:activation`}
                          onClick={() => resendAccess(u.id, 'activation')}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-40 whitespace-nowrap"
                          title="Reenviar correo de activación"
                        >
                          {resendingId === `${u.id}:activation` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Mail className="w-3 h-3" />
                          )}
                          Reenviar activación
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isSaving || resendingId === `${u.id}:reset`}
                        onClick={() => resendAccess(u.id, 'reset')}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
                        title="Enviar enlace para restablecer contraseña"
                      >
                        {resendingId === `${u.id}:reset` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <KeyRound className="w-3 h-3" />
                        )}
                        Restablecer acceso
                      </button>
                    </div>
                  )}

                  {/* Activar / desactivar */}
                  <button
                    disabled={isSelf || isSaving}
                    onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition disabled:opacity-40
                      ${u.is_active ? 'border-yellow-200 text-yellow-700 hover:bg-yellow-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                  >
                    {u.is_active ? 'Desactivar' : 'Activar'}
                  </button>

                  {/* Quitar */}
                  {!isSelf && (
                    <button
                      disabled={isSaving}
                      onClick={() => removeUser(u.id, u.full_name)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Quitar acceso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
