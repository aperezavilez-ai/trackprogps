import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/scope'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const filterCompany = searchParams.get('company_id')
  const driverId      = searchParams.get('driver_id')

  const companyId = isSuperAdmin(profile)
    ? (filterCompany || null)
    : profile.company_id

  if (!companyId) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, email, status')
      .neq('status', 'cancelled')
      .order('name')

    return NextResponse.json({
      needs_company: true,
      companies: companies ?? [],
    })
  }

  const [{ data: company }, { data: subscription }, { data: plans }] = await Promise.all([
    supabase.from('companies').select('id, name, email, status, settings').eq('id', companyId).single(),
    supabase.from('subscriptions').select('*, plan:plans(*)').eq('company_id', companyId).maybeSingle(),
    supabase.from('plans').select('*').eq('is_active', true).order('price_monthly'),
  ])

  if (!company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  let driversQuery = supabase
    .from('drivers')
    .select(`
      id, full_name, phone, email, is_active,
      vehicles(id, economic_num, plates, status, device:gps_devices(id, imei, status))
    `)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('full_name')

  if (driverId) driversQuery = driversQuery.eq('id', driverId)

  const { data: drivers } = await driversQuery

  const billingSettings = (company.settings as Record<string, unknown> | null)?.['billing_cfdi'] ?? null

  const clients = (drivers ?? []).map(d => {
    const vehicles = Array.isArray(d.vehicles) ? d.vehicles : d.vehicles ? [d.vehicles] : []
    const activeVehicles = vehicles.filter((v: { status: string }) => v.status === 'active')
    const withGps = vehicles.filter((v: { device: unknown }) => v.device)
    return {
      id: d.id,
      full_name: d.full_name,
      phone: d.phone,
      email: d.email,
      is_active: d.is_active,
      vehicles_count: vehicles.length,
      active_vehicles: activeVehicles.length,
      gps_devices: withGps.length,
      vehicles: vehicles.map((v: {
        id: string; economic_num: string; plates: string; status: string
        device: { id: string; imei: string; status: string } | null
      }) => ({
        id: v.id,
        economic_num: v.economic_num,
        plates: v.plates,
        status: v.status,
        device: v.device,
      })),
    }
  })

  return NextResponse.json({
    company: { id: company.id, name: company.name, email: company.email, status: company.status },
    subscription,
    plans: plans ?? [],
    billing_settings: billingSettings,
    clients,
    stripe_configured: !!subscription?.stripe_subscription_id,
  })
}
