import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { getMobileCompanyId } from '@/lib/mobile/mobile-context'
import { mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'admin_empresa', 'supervisor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { device_id } = await request.json()
  if (!device_id) {
    return NextResponse.json({ error: 'device_id required' }, { status: 422 })
  }

  const service = createSupabaseServiceClient()
  let companyId: string
  try {
    ;({ companyId } = await getMobileCompanyId(supabase, user.id, service))
  } catch (err) {
    return mobileCompanyErrorResponse(err)
  }

  const now = new Date().toISOString()

  await service
    .from('mobile_sessions')
    .update({ revoked_at: now })
    .eq('device_id', device_id)
    .is('revoked_at', null)

  await service
    .from('gps_devices')
    .update({ tracking_enabled: false, updated_at: now })
    .eq('id', device_id)
    .eq('company_id', companyId)

  return NextResponse.json({ success: true })
}
