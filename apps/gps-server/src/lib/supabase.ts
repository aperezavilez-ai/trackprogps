// Shared Supabase service client for Node.js (requires ws for Realtime)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

// Node 20 needs explicit WebSocket for @supabase/realtime-js
if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws as unknown as typeof WebSocket
}

export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
