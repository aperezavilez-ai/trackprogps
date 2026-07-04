import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { registerOrUpdateMobileDevice } from '@/lib/mobile/device-registry'
import { AdminMobileRegisterSchema, DeviceOwnerSchema } from '@/lib/mobile/schemas'
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
  device_owner: DeviceOwnerSchema.optional(),
  sim_recharge: z.object({
    carrier: z.string().min(1).max(40),
    amount: z.number().min(0).max(99999).nullable().optional(),
    recharge_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validity_days: z.number().int().min(1).max(366).default(30),
    alert_days_before: z.number().int().min(0).max(30).default(3),
    notes: z.string().max(1000).nullable().optional(),
  }).nullable().optional(),
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
    .select('*, vehicle:vehicles(economic_num, plates), sim_recharges:device_sim_recharges(id, carrier, phone_num, amount, currency, recharge_date, validity_days, next_recharge_date, alert_days_before, notes, created_at)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('recharge_date', { referencedTable: 'device_sim_recharges', ascending: false })
    .limit(1, { referencedTable: 'device_sim_recharges' })
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
        imei: parsed.data.imei?.trim() || null,
        simIccid: parsed.data.sim_iccid?.trim() || null,
        phoneNum: parsed.data.phone_num?.trim() || null,
        firmwareVer: parsed.data.firmware_ver?.trim() || null,
        brand: parsed.data.brand?.trim() || null,
        model: parsed.data.model?.trim() || null,
        osVersion: parsed.data.os_version?.trim() || null,
        appVersion: parsed.data.app_version?.trim() || null,
        deviceNotes: parsed.data.device_notes?.trim() || null,
        trackingIntervalSec: parsed.data.tracking_interval_sec,
        deviceOwner: parsed.data.device_owner,
        responsibleContact: parsed.data.responsible_contact,
        emergencyContacts: parsed.data.emergency_contacts,
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
  const { source_type: _st, company_id: _cid, sim_recharge, device_owner, ...hwData } = hw
  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('gps_devices')
    .insert({
      ...hwData,
      protocol_metadata: {
        ...(hwData.protocol_metadata ?? {}),
        ...(device_owner ? { device_owner } : {}),
      },
      company_id: companyId,
      source_type: 'hardware',
    })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Device with this IMEI already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (sim_recharge) {
    await service.from('device_sim_recharges').insert({
      company_id: companyId,
      device_id: data.id,
      carrier: sim_recharge.carrier,
      phone_num: hwData.phone_num ?? null,
      amount: sim_recharge.amount ?? null,
      recharge_date: sim_recharge.recharge_date,
      validity_days: sim_recharge.validity_days,
      alert_days_before: sim_recharge.alert_days_before,
      notes: sim_recharge.notes ?? null,
      created_by: user.id,
    })
  }

  return NextResponse.json({ data }, { status: 201 })
}
