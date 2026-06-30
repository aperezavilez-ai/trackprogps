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

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof NextResponse) return auth

  const denied = requirePermission(auth, 'read:devices')
  if (denied) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/devices', 403)
    return denied
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10)))
  const offset = (page - 1) * perPage
  const sourceType = searchParams.get('source_type')

  const service = createSupabaseServiceClient()
  let query = service
    .from('gps_devices')
    .select('id, imei, model, status, last_seen, source_type, phone_num, vehicle:vehicles(id, economic_num, plates)', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (sourceType === 'mobile' || sourceType === 'hardware') {
    query = query.eq('source_type', sourceType)
  }

  const { data, count, error } = await query

  if (error) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/devices', 500)
    return v1Json(auth, { error: { code: 'INTERNAL', message: error.message } }, 500)
  }

  logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/devices', 200)
  return v1Json(auth, {
    data: data ?? [],
    meta: { count: count ?? 0, page, per_page: perPage },
  })
}
