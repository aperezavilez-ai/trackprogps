import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { registerOrUpdateMobileDevice } from '@/lib/mobile/device-registry'
import { AdminMobileRegisterSchema } from '@/lib/mobile/schemas'
import { randomBytes } from 'crypto'
import { resolveTargetCompanyId } from '@/lib/billing/company-context'
import { assertHardwareDeviceLimit, assertMobileDeviceLimit } from '@/lib/billing/plan-guard'

const HardwareDeviceSchema = z.object({
  source_type: z.literal('hardware').optional(),
  company_id: z.string().uuid().optional(),
  imei:         z.string().length(15).regex(/^\d+$/, 'IMEI must be 15 digits'),
  model:        z.string().min(1).max(50).default('FMC920'),
  firmware_ver: z.string().max(20).nullable().optional(),
  sim_iccid:    z.string().max(30).nullable().optional(),
  phone_num:    z.string().max(20).nullable().optional(),
  protocol_metadata: z.record(z.unknown()).optional(),
})

const DeviceSchema = z.union([
  HardwareDeviceSchema,
  AdminMobileRegisterSchema.extend({
    source_type: z.literal('mobile'),
    company_id: z.string().uuid().optional(),
  }),
])

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page    = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage = parseInt(searchParams.get('per_page') ?? '50', 10)
  const offset  = (page - 1) * perPage
  const sourceType = searchParams.get('source_type')
  const companyId = searchParams.get('company_id')

  let query = supabase
    .from('gps_devices')
    .select('*, vehicle:vehicles(economic_num, plates)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (sourceType === 'mobile' || sourceType === 'hardware') {
    query = query.eq('source_type', sourceType)
  }

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, per_page: perPage, total_pages: Math.ceil((count ?? 0) / perPage) })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body   = await request.json()
  const parsed = DeviceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const bodyCompanyId = 'company_id' in parsed.data ? parsed.data.company_id : undefined
  const resolved = await resolveTargetCompanyId(supabase, profile, bodyCompanyId)
  if (resolved instanceof NextResponse) return resolved
  const { companyId } = resolved

  if ('assigned_user_id' in parsed.data && parsed.data.source_type === 'mobile') {
    const mobileBlock = await assertMobileDeviceLimit(supabase, companyId, profile.role)
    if (mobileBlock) return mobileBlock

    const service = createSupabaseServiceClient()
    const deviceUid = `ADM-${randomBytes(12).toString('hex')}`
    try {
      const result = await registerOrUpdateMobileDevice(service, {
        companyId,
        userId: parsed.data.assigned_user_id,
        deviceUid,
        platform: parsed.data.platform,
        label: parsed.data.label,
        trackingIntervalSec: parsed.data.tracking_interval_sec,
      })
      const { data: device } = await service
        .from('gps_devices')
        .select('*, vehicle:vehicles(economic_num, plates)')
        .eq('id', result.device_id)
        .single()
      return NextResponse.json({ data: device }, { status: 201 })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
    }
  }

  const hwBlock = await assertHardwareDeviceLimit(supabase, companyId, profile.role)
  if (hwBlock) return hwBlock

  const hw = parsed.data as z.infer<typeof HardwareDeviceSchema>
  const { source_type: _st, company_id: _cid, ...hwData } = hw
  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('gps_devices')
    .insert({
      ...hwData,
      protocol_metadata: hwData.protocol_metadata ?? {},
      company_id: companyId,
      source_type: 'hardware',
    })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Device with this IMEI already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
