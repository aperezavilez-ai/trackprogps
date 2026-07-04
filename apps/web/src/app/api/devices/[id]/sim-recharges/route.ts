import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RechargeSchema = z.object({
  carrier: z.string().min(1).max(40),
  amount: z.number().min(0).max(99999).nullable().optional(),
  recharge_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validity_days: z.number().int().min(1).max(366).default(30),
  alert_days_before: z.number().int().min(0).max(30).default(3),
  notes: z.string().max(1000).nullable().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: device, error: deviceError } = await supabase
    .from('gps_devices')
    .select('id, company_id, imei, model, phone_num, sim_iccid, source_type, vehicle:vehicles(economic_num, plates)')
    .eq('id', params.id)
    .single()

  if (deviceError || !device) {
    return NextResponse.json({ error: deviceError?.message ?? 'Device not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('device_sim_recharges')
    .select('id, carrier, phone_num, amount, currency, recharge_date, validity_days, next_recharge_date, alert_days_before, notes, created_at')
    .eq('device_id', params.id)
    .order('recharge_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], device })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'admin_empresa', 'supervisor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = RechargeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { data: device, error: deviceError } = await supabase
    .from('gps_devices')
    .select('id, company_id, phone_num, source_type')
    .eq('id', params.id)
    .single()

  if (deviceError || !device) {
    return NextResponse.json({ error: deviceError?.message ?? 'Device not found' }, { status: 404 })
  }

  if (device.source_type !== 'hardware') {
    return NextResponse.json({ error: 'Solo los GPS hardware tienen saldo de chip' }, { status: 422 })
  }

  if (profile.role !== 'super_admin' && device.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('device_sim_recharges')
    .insert({
      company_id: device.company_id,
      device_id: params.id,
      phone_num: device.phone_num,
      carrier: parsed.data.carrier,
      amount: parsed.data.amount ?? null,
      recharge_date: parsed.data.recharge_date,
      validity_days: parsed.data.validity_days,
      alert_days_before: parsed.data.alert_days_before,
      notes: parsed.data.notes ?? null,
      created_by: user.id,
    })
    .select('id, carrier, phone_num, amount, currency, recharge_date, validity_days, next_recharge_date, alert_days_before, notes, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.rpc('create_sim_recharge_alerts')

  return NextResponse.json({ data }, { status: 201 })
}
