import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(_request: NextRequest) {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'))
}
