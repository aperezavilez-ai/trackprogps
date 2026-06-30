import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { getMobileCompanyId } from '@/lib/mobile/mobile-context'
import { mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createSupabaseServiceClient()
  let companyId: string
  try {
    ;({ companyId } = await getMobileCompanyId(supabase, user.id, service))
  } catch (err) {
    return mobileCompanyErrorResponse(err)
  }

  const { data: devices, error } = await service
    .from('gps_devices')
    .select(`
      id, imei, model, status, last_seen, mobile_platform, tracking_enabled,
      tracking_interval_sec, mobile_metadata, assigned_user_id,
      vehicle:vehicles(economic_num, plates, id)
    `)
    .eq('company_id', companyId)
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
