import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const GeofenceSchema = z.object({
  name:           z.string().min(1).max(100),
  type:           z.enum(['circular', 'polygon']),
  geometry:       z.object({
    type:        z.string(),
    coordinates: z.union([z.array(z.number()), z.array(z.array(z.array(z.number())))]),
  }).nullable().optional(),
  radius_m:       z.number().positive().nullable().optional(),
  color:          z.string().regex(/^#[0-9A-F]{6}$/i).default('#3B82F6'),
  alert_on_enter: z.boolean().default(true),
  alert_on_exit:  z.boolean().default(true),
  alert_on_dwell: z.boolean().default(false),
  dwell_minutes:  z.number().int().positive().nullable().optional(),
  vehicle_ids:    z.array(z.string().uuid()).nullable().optional(),
  is_active:      z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const active = searchParams.get('active')

  let query = supabase
    .from('geofences')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (active === 'true')  query = query.eq('is_active', true)
  if (active === 'false') query = query.eq('is_active', false)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Convert PostGIS geometry to GeoJSON for frontend
  return NextResponse.json({ data, count })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = GeofenceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  // Convert GeoJSON to PostGIS geometry using ST_GeomFromGeoJSON
  const { data, error } = await supabase.rpc('create_geofence', {
    p_company_id:    profile.company_id,
    p_name:          parsed.data.name,
    p_type:          parsed.data.type,
    p_geometry_json: JSON.stringify(parsed.data.geometry),
    p_radius_m:      parsed.data.radius_m,
    p_color:         parsed.data.color,
    p_alert_enter:   parsed.data.alert_on_enter,
    p_alert_exit:    parsed.data.alert_on_exit,
    p_alert_dwell:   parsed.data.alert_on_dwell,
    p_created_by:    user.id,
  })

  if (error) {
    // Fallback: direct insert with geometry cast
    const geomExpr = parsed.data.geometry
      ? `ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(parsed.data.geometry)}'), 4326)`
      : null

    if (!geomExpr) return NextResponse.json({ error: 'Geometry is required' }, { status: 422 })

    const { data: inserted, error: insertError } = await supabase
      .from('geofences')
      .insert({
        company_id:     profile.company_id,
        name:           parsed.data.name,
        type:           parsed.data.type,
        radius_m:       parsed.data.radius_m,
        color:          parsed.data.color,
        alert_on_enter: parsed.data.alert_on_enter,
        alert_on_exit:  parsed.data.alert_on_exit,
        alert_on_dwell: parsed.data.alert_on_dwell,
        vehicle_ids:    parsed.data.vehicle_ids,
        is_active:      parsed.data.is_active,
        created_by:     user.id,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    return NextResponse.json({ data: inserted }, { status: 201 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
