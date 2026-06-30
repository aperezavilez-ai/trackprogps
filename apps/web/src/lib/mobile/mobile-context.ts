import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { resolveMobileCompanyId, MobileCompanyError } from '@/lib/mobile/resolve-company'

type MobileProfile = { company_id: string | null; role: string }

export async function getMobileCompanyId(
  supabase: SupabaseClient,
  userId: string,
  service: SupabaseClient = createSupabaseServiceClient(),
): Promise<{ profile: MobileProfile; companyId: string; userId: string }> {
  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', userId)
    .single()

  if (!profile) throw new MobileCompanyError('Perfil no encontrado')

  const companyId = await resolveMobileCompanyId(profile, service)
  return { profile, companyId, userId }
}

export type MobileAuth = { user: User; supabase: SupabaseClient }
