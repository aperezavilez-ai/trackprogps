import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const TopUpSchema = z.object({
  carrier: z.string().min(1).max(40),
  amount: z.number().min(1).max(5000),
  phone_num: z.string().min(8).max(20).nullable().optional(),
})

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
  const parsed = TopUpSchema.safeParse(body)
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
    return NextResponse.json({ error: 'Solo los GPS hardware pueden recargar chip SIM' }, { status: 422 })
  }

  if (profile.role !== 'super_admin' && device.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const providerEnabled = process.env['SIM_TOPUP_PROVIDER_ENABLED'] === 'true'
  if (!providerEnabled) {
    return NextResponse.json({
      error: 'Proveedor de recargas no configurado',
      code: 'SIM_TOPUP_PROVIDER_NOT_CONFIGURED',
      message: 'La plataforma ya esta lista para recargas reales, pero falta contratar y configurar el proveedor/API de tiempo aire.',
      required_config: ['SIM_TOPUP_PROVIDER_ENABLED', 'SIM_TOPUP_PROVIDER', 'SIM_TOPUP_API_KEY'],
      request: {
        carrier: parsed.data.carrier,
        amount: parsed.data.amount,
        phone_num: parsed.data.phone_num ?? device.phone_num,
      },
    }, { status: 501 })
  }

  return NextResponse.json({
    error: 'Proveedor de recargas pendiente de integracion',
    code: 'SIM_TOPUP_PROVIDER_PENDING',
  }, { status: 501 })
}
