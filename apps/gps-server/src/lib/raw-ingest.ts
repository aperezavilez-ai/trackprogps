import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from './supabase.js'

type RawPacketInput = {
  imei?: string | null
  protocolAdapterKey?: string | null
  remoteAddress?: string | null
  payload: Buffer
  parseStatus: 'identified' | 'parsed' | 'invalid' | 'pending'
  parseError?: string | null
  payloadJson?: Record<string, unknown> | null
}

let supabaseClient: SupabaseClient | null | undefined
const protocolIdCache = new Map<string, string | null>()

function getClient(): SupabaseClient | null {
  if (supabaseClient !== undefined) return supabaseClient
  if (!process.env['NEXT_PUBLIC_SUPABASE_URL'] || !process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    supabaseClient = null
    return null
  }

  supabaseClient = createSupabaseServiceClient()
  return supabaseClient
}

async function resolveProtocolId(
  supabase: SupabaseClient,
  adapterKey: string | null | undefined,
): Promise<string | null> {
  if (!adapterKey) return null
  if (protocolIdCache.has(adapterKey)) return protocolIdCache.get(adapterKey) ?? null

  const { data } = await supabase
    .from('gps_protocols')
    .select('id')
    .eq('adapter_key', adapterKey)
    .maybeSingle()

  const protocolId = (data?.id as string | undefined) ?? null
  protocolIdCache.set(adapterKey, protocolId)
  return protocolId
}

export function recordRawIngestPacket(input: RawPacketInput): void {
  const supabase = getClient()
  if (!supabase) return

  void (async () => {
    try {
      const protocolId = await resolveProtocolId(supabase, input.protocolAdapterKey)
      await supabase.from('raw_ingest_packets').insert({
        imei: input.imei ?? null,
        protocol_id: protocolId,
        source_type: 'hardware',
        transport: 'tcp',
        remote_address: input.remoteAddress ?? null,
        payload_hex: input.payload.toString('hex'),
        payload_json: input.payloadJson ?? null,
        parse_status: input.parseStatus,
        parse_error: input.parseError ?? null,
      })
    } catch (err) {
      console.warn('[GPS] Unable to persist raw packet:', err instanceof Error ? err.message : err)
    }
  })()
}
