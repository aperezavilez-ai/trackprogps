import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, UserPlus, Headphones } from 'lucide-react'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export const dynamic = 'force-dynamic'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; status?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    redirect('/dashboard')
  }

  if (profile.role !== 'super_admin') {
    redirect('/admin/users')
  }

  const page    = parseInt(searchParams.page ?? '1', 10)
  const search  = searchParams.search ?? ''
  const status  = searchParams.status ?? ''
  const perPage = 25
  const offset  = (page - 1) * perPage

  let query = supabase
    .from('companies')
    .select(`
      id, name, email, status, created_at,
      plan:plans(name, type),
      subscription:subscriptions(status, current_period_end),
      _count:vehicles(count)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  if (status) query = query.eq('status', status)

  const { data: companies, count } = await query

  const [{ count: totalCompanies }, { count: totalVehicles }, { count: totalAlerts }, { count: supportNew }] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('vehicles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).is('acknowledged_at', null),
    createSupabaseServiceClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'nuevo'),
  ])

  const STATUS_COLORS: Record<string, string> = {
    active:    'bg-green-50 text-green-700 border-green-200',
    demo:      'bg-amber-50 text-amber-800 border-amber-200',
    trial:     'bg-orange-50 text-orange-600 border-orange-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  }

  const STATUS_LABELS: Record<string, string> = {
    active: 'Activa', demo: 'Demostración', trial: 'Prueba', suspended: 'Suspendida', cancelled: 'Cancelada',
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs text-orange-500 uppercase tracking-wider font-medium mb-1">Plataforma TrackPro</p>
          <h1 className="text-2xl font-semibold text-gray-900">Administrador</h1>
          <p className="text-sm text-gray-500 mt-1">Empresas, suscripciones y usuarios de la plataforma</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href="/admin/support"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-200 text-orange-700 text-sm font-medium rounded-xl hover:bg-orange-50 transition relative"
          >
            <Headphones className="w-4 h-4" />
            Soporte
            {(supportNew ?? 0) > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center">
                {supportNew}
              </span>
            )}
          </Link>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition"
          >
            <UserPlus className="w-4 h-4" />
            Usuarios
          </Link>
          <Link
            href="/billing?tab=ingresos"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
          >
            <Building2 className="w-4 h-4" />
            Ingresos
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total empresas', value: totalCompanies ?? 0, color: 'text-orange-500' },
          { label: 'Total vehículos', value: totalVehicles ?? 0, color: 'text-green-600' },
          { label: 'Alertas activas', value: totalAlerts ?? 0, color: 'text-red-600' },
          { label: 'En esta página', value: count ?? 0, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Empresas ({count ?? 0})</h2>
          <form method="GET" className="flex flex-wrap gap-2">
            <input
              name="search"
              defaultValue={search}
              placeholder="Buscar empresa..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <select
              name="status"
              defaultValue={status}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todos</option>
              <option value="active">Activas</option>
              <option value="demo">Demo</option>
              <option value="trial">Prueba</option>
              <option value="suspended">Suspendidas</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <button
              type="submit"
              className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-600"
            >
              Filtrar
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Empresa', 'Plan', 'Suscripción', 'Registro', 'Vencimiento', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(companies ?? []).map(company => {
                const plan = firstOrNull(company.plan) as { name: string; type: string } | null
                const sub  = Array.isArray(company.subscription)
                  ? company.subscription[0]
                  : company.subscription as { status: string; current_period_end: string } | null
                const statusCfg = STATUS_COLORS[company.status] ?? STATUS_COLORS.cancelled!

                return (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{company.name}</div>
                      <div className="text-xs text-gray-500">{company.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        plan?.type === 'empresarial' ? 'bg-purple-50 text-purple-700' :
                        plan?.type === 'profesional' ? 'bg-orange-50 text-orange-600' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {plan?.name ?? 'Sin plan'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{sub?.status ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(company.created_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {sub?.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg}`}>
                        {STATUS_LABELS[company.status] ?? company.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/billing?tab=pagos&company_id=${company.id}`}
                        className="text-xs text-orange-500 hover:underline px-2 py-1 rounded hover:bg-orange-50"
                      >
                        Facturación
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {(count ?? 0) > perPage && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">{count} empresas</span>
            <div className="flex gap-1">
              {page > 1 && (
                <Link
                  href={`/admin?page=${page - 1}&search=${encodeURIComponent(search)}&status=${status}`}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Anterior
                </Link>
              )}
              {page * perPage < (count ?? 0) && (
                <Link
                  href={`/admin?page=${page + 1}&search=${encodeURIComponent(search)}&status=${status}`}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Siguiente
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
