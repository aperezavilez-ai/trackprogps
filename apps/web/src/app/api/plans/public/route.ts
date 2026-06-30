import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const FALLBACK_PLANS = [
  { id: 'basico', name: 'Básico', type: 'basico', max_vehicles: 10, max_users: 3, price_monthly: 299, price_yearly: 2990 },
  { id: 'pro', name: 'Profesional', type: 'profesional', max_vehicles: 50, max_users: 10, price_monthly: 799, price_yearly: 7990 },
  { id: 'empresa', name: 'Empresarial', type: 'empresarial', max_vehicles: 999, max_users: 999, price_monthly: 2499, price_yearly: 24990 },
]

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('plans')
    .select('id, name, type, max_vehicles, max_users, max_mobile_devices, price_monthly, price_yearly, features')
    .eq('is_active', true)
    .order('price_monthly')

  return NextResponse.json({ data: data?.length ? data : FALLBACK_PLANS })
}
