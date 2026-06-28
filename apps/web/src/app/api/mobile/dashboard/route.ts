import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createSupabaseServiceClient()
  const { data: devices, error } = await service
    .from('gps_devices')
    .select(`
      id, imei, model, status, last_seen, mobile_platform, tracking_enabled,
      tracking_interval_sec, mobile_metadata, assigned_user_id,
      vehicle:vehicles(economic_num, plates, id)
    `)
    .eq('company_id', profile.company_id)
    .eq('source_type', 'mobile')
    .order('last_seen', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = devices ?? []
  const stats = {
    total: list.length,
    online: list.filter(d => d.status === 'online').length,
    offline: list.filter(d => d.status !== 'online').length,
    tracking_enabled: list.filter(d => d.tracking_enabled).length,
  }

  return NextResponse.json({ data: { devices: list, stats } })
}
