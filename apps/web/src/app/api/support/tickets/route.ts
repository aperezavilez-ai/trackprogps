import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { canAccessSupportInbox, getSupportActor } from '@/lib/auth/support-access'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const actor = await getSupportActor(supabase, user.id)
  if (!canAccessSupportInbox(actor)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  const status = request.nextUrl.searchParams.get('status') ?? ''
  const service = createSupabaseServiceClient()

  let query = service
    .from('support_tickets')
    .select('id, email, phone, subject, status, source, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status && status !== 'todos') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
