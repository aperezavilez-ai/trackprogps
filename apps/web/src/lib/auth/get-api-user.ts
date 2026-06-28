import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export async function getApiUser(
  request?: NextRequest,
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const cookieClient = createSupabaseServerClient()
  const { data: { user: cookieUser } } = await cookieClient.auth.getUser()
  if (cookieUser) return { user: cookieUser, supabase: cookieClient }

  const authHeader = request?.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const { createClient } = await import('@supabase/supabase-js')
  const bearerClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )

  const { data: { user } } = await bearerClient.auth.getUser()
  if (!user) return null
  return { user, supabase: bearerClient }
}
