'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  canAccessBillingOnly,
  getAccountPhase,
  type AccountPhaseInput,
} from '@/lib/billing/account-phase'

interface Props extends AccountPhaseInput {
  role: string
}

export function DemoGate({
  role,
  companyStatus,
  settings,
  subscriptionStatus,
  stripeSubscriptionId,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (role !== 'admin_empresa' || !companyStatus) return

    const phase = getAccountPhase({
      companyStatus,
      settings,
      subscriptionStatus,
      stripeSubscriptionId,
    })

    if (phase === 'suspended' && pathname !== '/suspended') {
      router.replace('/suspended')
      return
    }

    // Sin plan y fuera de demo (legacy): solo facturación
    if (phase === 'needs_plan' && !canAccessBillingOnly(pathname)) {
      router.replace('/billing?tab=suscripcion')
    }
  }, [role, companyStatus, settings, subscriptionStatus, stripeSubscriptionId, pathname, router])

  return null
}
