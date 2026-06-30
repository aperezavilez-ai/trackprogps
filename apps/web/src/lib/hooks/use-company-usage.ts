'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface CompanyUsage {
  vehicles:         { current: number; max: number }
  mobile_devices?:  { current: number; max: number }
  users:            { current: number; max: number }
  features:         Record<string, boolean | number>
  at_vehicle_limit: boolean
  at_mobile_limit?: boolean
  at_user_limit:    boolean
  mobile_only_plan?: boolean
}

export function useCompanyUsage(companyId: string) {
  const [usage, setUsage]       = useState<CompanyUsage | null>(null)
  const [loading, setLoading]   = useState(true)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    if (!companyId) return

    async function load() {
      const { data, error } = await supabase.rpc('get_company_usage', {
        p_company_id: companyId,
      })

      if (!error && data) {
        setUsage(data as CompanyUsage)
      }
      setLoading(false)
    }

    void load()
  }, [companyId, supabase])

  return { usage, loading }
}

export function usePlanFeature(feature: string, companyId: string): boolean {
  const { usage } = useCompanyUsage(companyId)
  if (!usage) return false
  const val = usage.features[feature]
  return val === true || (typeof val === 'number' && val > 0)
}
