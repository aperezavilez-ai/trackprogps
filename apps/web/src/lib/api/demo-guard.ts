import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isDemoTourCompany } from '@/lib/billing/account-phase'

export async function assertNotDemoTour(
  supabase: SupabaseClient,
): Promise<NextResponse | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('company:companies(status, settings)')
    .eq('id', user.id)
    .single()

  const company = profile?.company as { status: string; settings: Record<string, unknown> | null } | null
  if (isDemoTourCompany(company)) {
    return NextResponse.json(
      {
        error: 'demo_tour',
        message: 'Modo demostración: explora la app con datos de ejemplo. Contrata un plan para guardar cambios.',
      },
      { status: 403 },
    )
  }

  return null
}
