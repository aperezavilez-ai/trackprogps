import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DriversTable } from '@/components/fleet/drivers-table'

export const dynamic = 'force-dynamic'

export default async function DriversPage({ searchParams }: { searchParams: { page?: string; search?: string } }) {
  const supabase = createSupabaseServerClient()
  const page    = parseInt(searchParams.page ?? '1', 10)
  const search  = searchParams.search ?? ''
  const perPage = 20
  const offset  = (page - 1) * perPage

  let query = supabase
    .from('drivers')
    .select('*, vehicle:vehicles(economic_num, plates)', { count: 'exact' })
    .is('deleted_at', null)
    .order('full_name')
    .range(offset, offset + perPage - 1)

  if (search) query = query.or(`full_name.ilike.%${search}%,license_num.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data: drivers, count } = await query

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Choferes</h1>
          <p className="text-sm text-gray-500 mt-1">{count ?? 0} choferes registrados</p>
        </div>
        <button id="btn-add-driver"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
          + Agregar chofer
        </button>
      </div>
      <DriversTable drivers={drivers ?? []} count={count ?? 0} page={page} perPage={perPage} search={search} />
    </div>
  )
}
