import { NextResponse, type NextRequest } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { LocationShareSchema } from '@/lib/mobile/schemas'
import { getMobileCompanyId } from '@/lib/mobile/mobile-context'
import { mobileCompanyErrorResponse } from '@/lib/mobile/resolve-company'

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const parsed = LocationShareSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { data: device } = await service
    .from('gps_devices')
    .select('id, company_id, vehicles(id)')
    .eq('id', parsed.data.device_id)
    .eq('company_id', companyId)
    .eq('source_type', 'mobile')
    .maybeSingle()

  if (!device) {
    return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })
  }

  const token = randomBytes(24).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + parsed.data.duration_minutes * 60_000).toISOString()
  const vehicle = Array.isArray(device.vehicles) ? device.vehicles[0] : device.vehicles

  const { error } = await service.from('mobile_location_shares').insert({
    company_id: companyId,
    device_id: device.id,
    vehicle_id: vehicle?.id ?? null,
    created_by: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trackprogps.mx'
  return NextResponse.json({
    data: {
      share_url: `${baseUrl}/compartir/${token}`,
      expires_at: expiresAt,
      duration_minutes: parsed.data.duration_minutes,
    },
  }, { status: 201 })
}
