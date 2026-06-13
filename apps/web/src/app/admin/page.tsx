import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  if (profile?.role !== 'super_admin') redirect('/dashboard')

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

  // Platform stats
  const [{ count: totalCompanies }, { count: totalVehicles }, { count: totalAlerts }] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('vehicles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).is('acknowledged_at', null),
  ])

  const STATUS_COLORS: Record<string, string> = {
    active:    'bg-green-50 text-green-700 border-green-200',
    trial:     'bg-blue-50 text-blue-700 border-blue-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  }

  const STATUS_LABELS: Record<string, string> = {
    active: 'Activa', trial: 'Prueba', suspended: 'Suspendida', cancelled: 'Cancelada',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin header */}
      <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Super Admin</div>
          <h1 className="text-lg font-bold">TrackPro — Panel de Control</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
          ← Volver al dashboard
        </Link>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Platform stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total empresas',    value: totalCompanies ?? 0,  color: 'text-blue-600' },
            { label: 'Total vehículos',   value: totalVehicles ?? 0,   color: 'text-green-600' },
            { label: 'Alertas activas',   value: totalAlerts ?? 0,     color: 'text-red-600' },
            { label: 'Revenue estimado',  value: '$0 MXN',             color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Companies table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Empresas ({count ?? 0})</h2>
            <div className="flex gap-2">
              <form method="GET" className="flex gap-2">
                <input
                  name="search"
                  defaultValue={search}
                  placeholder="Buscar empresa..."
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  name="status"
                  defaultValue={status}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="active">Activas</option>
                  <option value="trial">Prueba</option>
                  <option value="suspended">Suspendidas</option>
                  <option value="cancelled">Canceladas</option>
                </select>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                >
                  Filtrar
                </button>
              </form>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Empresa', 'Plan', 'Estado suscripción', 'Registro', 'Vencimiento', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(companies ?? []).map(company => {
                const plan = company.plan as { name: string; type: string } | null
                const sub  = Array.isArray(company.subscription)
                  ? company.subscription[0]
                  : company.subscription as { status: string; current_period_end: string } | null
                const statusCfg = STATUS_COLORS[company.status] ?? STATUS_COLORS['cancelled']!

                return (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{company.name}</div>
                      <div className="text-xs text-gray-500">{company.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        plan?.type === 'empresarial' ? 'bg-purple-50 text-purple-700' :
                        plan?.type === 'profesional' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {plan?.name ?? 'Sin plan'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">{sub?.status ?? '—'}</span>
                    </td>
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
                      <AdminCompanyActions companyId={company.id} status={company.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {(count ?? 0) > perPage && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">{count} empresas</span>
              <div className="flex gap-1">
                {page > 1 && (
                  <Link
                    href={`/admin?page=${page - 1}&search=${search}&status=${status}`}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Anterior
                  </Link>
                )}
                {page * perPage < (count ?? 0) && (
                  <Link
                    href={`/admin?page=${page + 1}&search=${search}&status=${status}`}
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
    </div>
  )
}

// Server component for inline actions (links only - mutations need API)
function AdminCompanyActions({ companyId, status }: { companyId: string; status: string }) {
  return (
    <div className="flex gap-1">
      <Link
        href={`/admin/companies/${companyId}`}
        className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50"
      >
        Ver
      </Link>
      {status === 'active' && (
        <span className="text-xs text-gray-400 px-2 py-1">Activa</span>
      )}
      {status === 'suspended' && (
        <span className="text-xs text-yellow-600 px-2 py-1">Suspendida</span>
      )}
    </div>
  )
}
