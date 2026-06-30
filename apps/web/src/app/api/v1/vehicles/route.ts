import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { firstOrNull } from '@/lib/supabase/normalize'
import {
  authenticateApiKey,
  apiRateLimitHeaders,
  requirePermission,
  logApiRequest,
} from '@/lib/api/api-key-auth'

function v1Response(auth: Parameters<typeof apiRateLimitHeaders>[0], body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: apiRateLimitHeaders(auth, auth.rateLimitRemaining),
  })
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof NextResponse) return auth

  const denied = requirePermission(auth, 'read')
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10)))
  const offset = (page - 1) * perPage

  const service = createSupabaseServiceClient()
  const { data, count, error } = await service
    .from('vehicles')
    .select(`
      id, economic_num, plates, brand, model, status,
      device:gps_devices(id, imei, model, status, last_seen, source_type),
      position:vehicle_positions(lat, lng, speed, heading, ignition, recorded_at)
    `, { count: 'exact' })
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .order('economic_num', { ascending: true })
    .range(offset, offset + perPage - 1)

  if (error) {
    return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
  }

  const items = (data ?? []).map(v => ({
    id: v.id,
    economic_num: v.economic_num,
    plates: v.plates,
    brand: v.brand,
    model: v.model,
    status: v.status,
    device: firstOrNull(v.device as { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string } | { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string }[] | null)
      ? {
          id: firstOrNull(v.device as { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string } | { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string }[] | null)!.id,
          status: firstOrNull(v.device as { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string } | { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string }[] | null)!.status,
          source_type: firstOrNull(v.device as { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string } | { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string }[] | null)!.source_type ?? 'hardware',
          last_seen: firstOrNull(v.device as { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string } | { id: string; imei: string; model: string; status: string; last_seen: string | null; source_type?: string }[] | null)!.last_seen,
        }
      : null,
    position: v.position ?? null,
  }))

  return v1Response(auth, { data: items, meta: { count: count ?? items.length, page, per_page: perPage } })
}
