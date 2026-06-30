import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  ensurePlatformInternalCompany,
  ensureSandboxMobilePlan,
} from '@/lib/auth/platform-team'

type ProfileSlice = { company_id: string | null; role: string }

export async function resolveMobileCompanyId(
  profile: ProfileSlice,
  service: SupabaseClient = createSupabaseServiceClient(),
): Promise<string> {
  if (profile.company_id) return profile.company_id

  if (profile.role === 'super_admin') {
    const companyId = await ensurePlatformInternalCompany(service)
    await ensureSandboxMobilePlan(service, companyId)
    return companyId
  }

  throw new MobileCompanyError('Usuario sin empresa asignada')
}

export class MobileCompanyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MobileCompanyError'
  }
}

export function mobileCompanyErrorResponse(error: unknown): NextResponse {
  if (error instanceof MobileCompanyError) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Error' },
    { status: 500 },
  )
}
