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

  const denied = requirePermission(auth, 'read')
  if (denied) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/usage', 403)
    return denied
  }

  const service = createSupabaseServiceClient()
  const { data, error } = await service.rpc('get_company_usage', { p_company_id: auth.companyId })

  if (error) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/usage', 500)
    return v1Json(auth, { error: { code: 'INTERNAL', message: error.message } }, 500)
  }

  logApiRequest(auth.companyId, auth.keyId, 'GET', '/api/v1/usage', 200)
  return v1Json(auth, { data })
}
