'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  canAccessAppDuringTrialExpiry,
  getTrialStatus,
  type TrialStatusInput,
} from '@/lib/billing/trial-status'

interface Props extends TrialStatusInput {
  role: string
}

export function TrialGate({
  role,
  companyStatus,
  trialEndsAt,
  subscriptionStatus,
  stripeSubscriptionId,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (role !== 'admin_empresa' || !companyStatus) return

    const phase = getTrialStatus({
      companyStatus,
      trialEndsAt,
      subscriptionStatus,
      stripeSubscriptionId,
    })

    if (phase === 'suspended' && pathname !== '/suspended') {
      router.replace('/suspended')
      return
    }

    if (phase === 'expired' && !canAccessAppDuringTrialExpiry(pathname)) {
      router.replace('/billing?trial_expired=1&tab=suscripcion')
    }
  }, [role, companyStatus, trialEndsAt, subscriptionStatus, stripeSubscriptionId, pathname, router])

  return null
}
