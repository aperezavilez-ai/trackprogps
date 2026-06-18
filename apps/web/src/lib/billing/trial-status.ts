export type TrialPhase = 'active' | 'ending_soon' | 'expired' | 'paid' | 'suspended'

export interface TrialStatusInput {
  companyStatus: string | null
  trialEndsAt: string | null
  subscriptionStatus: string | null
  stripeSubscriptionId: string | null
}

export function getTrialStatus(input: TrialStatusInput): TrialPhase {
  const { companyStatus, trialEndsAt, subscriptionStatus, stripeSubscriptionId } = input

  if (companyStatus === 'suspended') return 'suspended'

  const isPaying =
    subscriptionStatus === 'active' &&
    (!!stripeSubscriptionId || companyStatus === 'active')

  if (isPaying) return 'paid'

  if (!trialEndsAt) return 'active'

  const endsAt = new Date(trialEndsAt)
  const now = new Date()
  const msLeft = endsAt.getTime() - now.getTime()
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

  if (msLeft <= 0) return 'expired'
  if (daysLeft <= 3) return 'ending_soon'
  return 'active'
}

export function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const msLeft = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
}

export const TRIAL_BILLING_PATHS = ['/billing', '/suspended', '/settings/profile']

export function canAccessAppDuringTrialExpiry(pathname: string): boolean {
  return TRIAL_BILLING_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}
