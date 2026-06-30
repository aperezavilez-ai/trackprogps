import type { SupabaseClient } from '@supabase/supabase-js'

const FALLBACK_TYPE_MAP: Record<string, string> = {
  basico: 'basico',
  pro: 'profesional',
  empresa: 'empresarial',
  personal_mobile: 'personal_mobile',
  familia_mobile: 'familia_mobile',
  mobile: 'personal_mobile',
}

export async function resolvePlanId(
  supabase: SupabaseClient,
  planRef: string
): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planRef)

  if (isUuid) {
    const { data } = await supabase.from('plans').select('id').eq('id', planRef).maybeSingle()
    return data?.id ?? null
  }

  const planType = FALLBACK_TYPE_MAP[planRef] ?? planRef
  const { data } = await supabase.from('plans').select('id').eq('type', planType).eq('is_active', true).maybeSingle()
  return data?.id ?? null
}
