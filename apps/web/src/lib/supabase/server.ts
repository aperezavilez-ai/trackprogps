import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? 'placeholder-anon-key'
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? 'placeholder-service-key'

export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - handled by middleware
          }
        },
      },
    }
  )
}

export function createSupabaseServiceClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
