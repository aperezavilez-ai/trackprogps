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

  const denied = requirePermission(auth, 'read:alerts')
  if (denied) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/alerts', 403)
    return denied
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10)))
  const offset = (page - 1) * perPage
  const severity = searchParams.get('severity')
  const acknowledged = searchParams.get('acknowledged')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const service = createSupabaseServiceClient()
  let query = service
    .from('alerts')
    .select(`
      id, type, severity, title, message, lat, lng, speed,
      acknowledged_at, created_at,
      vehicle:vehicles(economic_num, plates)
    `, { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (severity) query = query.eq('severity', severity)
  if (acknowledged === 'true') query = query.not('acknowledged_at', 'is', null)
  if (acknowledged === 'false') query = query.is('acknowledged_at', null)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, count, error } = await query

  if (error) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/alerts', 500)
    return v1Json(auth, { error: { code: 'INTERNAL', message: error.message } }, 500)
  }

  logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/alerts', 200)
  return v1Json(auth, {
    data: data ?? [],
    meta: { count: count ?? 0, page, per_page: perPage },
  })
}
