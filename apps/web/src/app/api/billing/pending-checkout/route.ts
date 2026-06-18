import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PendingCheckout {
  plan_id: string
  billing_period: 'monthly' | 'yearly'
}

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id || profile.role !== 'admin_empresa') {
    return NextResponse.json({ data: null })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', profile.company_id)
    .single()

  const settings = (company?.settings ?? {}) as Record<string, unknown>
  const pending = settings['pending_checkout'] as PendingCheckout | undefined

  if (!pending?.plan_id) return NextResponse.json({ data: null })

  return NextResponse.json({ data: pending })
}
