import { createHash, randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'

export type ApiKeyContext = {
  keyId: string
  companyId: string
  permissions: string[]
  rateLimit: number
  rateLimitRemaining: number
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString('hex')
  const key = `tpro_live_${secret}`
  const prefix = key.slice(0, 12)
  const hash = createHash('sha256').update(key).digest('hex')
  return { key, prefix, hash }
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

async function resolveRateLimit(supabase: ReturnType<typeof createSupabaseServiceClient>, companyId: string): Promise<number> {
  const { data } = await supabase.rpc('get_company_usage', { p_company_id: companyId })
  const features = (data as { features?: Record<string, unknown> } | null)?.features
  if (features?.['api_access'] === true) {
    return 5000
  }
  return 500
}

export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyContext | NextResponse> {
  const rawKey = request.headers.get('x-api-key')?.trim()
  if (!rawKey?.startsWith('tpro_')) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid X-API-Key' } }, { status: 401 })
  }

  const service = createSupabaseServiceClient()
  const keyHash = hashApiKey(rawKey)

  const { data: row, error } = await service
    .from('api_keys')
    .select('id, company_id, permissions, expires_at, is_active')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, { status: 401 })
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'API key expired' } }, { status: 401 })
  }

  const usage = await service.rpc('get_company_usage', { p_company_id: row.company_id })
  const features = (usage.data as { features?: Record<string, boolean> } | null)?.features
  if (!features?.api_access) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'API access not included in your plan' } },
      { status: 403 },
    )
  }

  const rateLimit = await resolveRateLimit(service, row.company_id)
  const rl = checkRateLimit(`api-v1:${row.company_id}`, rateLimit, 60 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded', retry_after: rl.retryAfterSec } },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSec),
          'X-RateLimit-Limit': String(rateLimit),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  void service.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', row.id)

  return {
    keyId: row.id,
    companyId: row.company_id,
    permissions: row.permissions ?? ['read'],
    rateLimit,
    rateLimitRemaining: rl.ok ? rl.remaining : 0,
  }
}

export function logApiRequest(
  companyId: string,
  apiKeyId: string,
  method: string,
  path: string,
  statusCode: number,
): void {
  const service = createSupabaseServiceClient()
  void service.from('api_request_logs').insert({
    company_id: companyId,
    api_key_id: apiKeyId,
    method,
    path,
    status_code: statusCode,
  })
}

export function requirePermission(ctx: ApiKeyContext, permission: string): NextResponse | null {
  if (ctx.permissions.includes(permission)) return null
  if (ctx.permissions.includes('read') && (permission === 'read' || permission.startsWith('read:'))) return null
  if (permission === 'read' && ctx.permissions.some(p => p === 'read' || p.startsWith('read:'))) return null
  return NextResponse.json(
    { error: { code: 'FORBIDDEN', message: `Permission required: ${permission}` } },
    { status: 403 },
  )
}

export function apiRateLimitHeaders(ctx: ApiKeyContext, remaining: number): Record<string, string> {
  const reset = Math.ceil(Date.now() / 1000) + 3600
  return {
    'X-RateLimit-Limit': String(ctx.rateLimit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(reset),
  }
}
