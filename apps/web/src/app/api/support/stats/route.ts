import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { canAccessSupportInbox, getSupportActor } from '@/lib/auth/support-access'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const actor = await getSupportActor(supabase, user.id)
  if (!canAccessSupportInbox(actor)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  const service = createSupabaseServiceClient()
  const { count: open } = await service
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'nuevo')

  const { count: inProgress } = await service
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'en_proceso')

  return NextResponse.json({
    data: {
      nuevo: open ?? 0,
      en_proceso: inProgress ?? 0,
      pending: (open ?? 0) + (inProgress ?? 0),
    },
  })
}
