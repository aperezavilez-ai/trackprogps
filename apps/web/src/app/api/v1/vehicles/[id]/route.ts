import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  authenticateApiKey,
  apiRateLimitHeaders,
  requirePermission,
  logApiRequest,
} from '@/lib/api/api-key-auth'

function v1Json(auth: Parameters<typeof apiRateLimitHeaders>[0], body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: apiRateLimitHeaders(auth, auth.rateLimitRemaining),
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof NextResponse) return auth

  const denied = requirePermission(auth, 'read:vehicles')
  if (denied) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}`, 403)
    return denied
  }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('vehicles')
    .select(`
      id, economic_num, plates, brand, model, year, status, max_speed, color, type,
      device:gps_devices(id, imei, model, status, last_seen, source_type),
      driver:drivers(id, full_name, phone),
      position:vehicle_positions(lat, lng, speed, heading, ignition, recorded_at)
    `)
    .eq('id', params.id)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}`, 500)
    return v1Json(auth, { error: { code: 'INTERNAL', message: error.message } }, 500)
  }

  if (!data) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}`, 404)
    return v1Json(auth, { error: { code: 'NOT_FOUND', message: 'Vehicle not found' } }, 404)
  }

  logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}`, 200)
  return v1Json(auth, { data })
}
