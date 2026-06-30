import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

/** Lista empresas cliente para super_admin (selector en dispositivos, etc.) */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !isSuperAdmin(profile)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, email, status, account_type, plan:plans(name, type, max_vehicles, max_mobile_devices, features)')
    .neq('email', 'interno@trackprogps.mx')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
