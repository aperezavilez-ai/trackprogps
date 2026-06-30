import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  authenticateApiKey,
  apiRateLimitHeaders,
  requirePermission,
  logApiRequest,
} from '@/lib/api/api-key-auth'
import { z } from 'zod'

const HistoryQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

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

  const denied = requirePermission(auth, 'read:history')
  if (denied) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}/history`, 403)
    return denied
  }

  const { searchParams } = new URL(request.url)
  const parsed = HistoryQuerySchema.safeParse({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  })

  if (!parsed.success) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}/history`, 422)
    return v1Json(auth, { error: { code: 'VALIDATION', message: 'from and to (ISO8601) required' } }, 422)
  }

  const { from, to } = parsed.data
  const diffDays = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
  if (diffDays > 7 || diffDays < 0) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}/history`, 422)
    return v1Json(auth, { error: { code: 'VALIDATION', message: 'Date range max 7 days' } }, 422)
  }

  const service = createSupabaseServiceClient()

  const { data: vehicle } = await service
    .from('vehicles')
    .select('id')
    .eq('id', params.id)
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!vehicle) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}/history`, 404)
    return v1Json(auth, { error: { code: 'NOT_FOUND', message: 'Vehicle not found' } }, 404)
  }

  const { data: points, error } = await service
    .from('position_history')
    .select('lat, lng, speed, heading, ignition, odometer, recorded_at')
    .eq('vehicle_id', params.id)
    .eq('company_id', auth.companyId)
    .gte('recorded_at', from)
    .lte('recorded_at', to)
    .order('recorded_at', { ascending: true })
    .limit(5000)

  if (error) {
    logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}/history`, 500)
    return v1Json(auth, { error: { code: 'INTERNAL', message: error.message } }, 500)
  }

  logApiRequest(auth.companyId, auth.keyId, 'GET', `/api/v1/vehicles/${params.id}/history`, 200)
  return v1Json(auth, {
    data: { vehicle_id: params.id, points: points ?? [] },
    meta: { count: points?.length ?? 0, from, to },
  })
}
