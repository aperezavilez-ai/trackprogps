export type AccountPhase = 'demo' | 'active' | 'suspended' | 'needs_plan'

export interface AccountPhaseInput {
  companyStatus: string | null
  settings?: Record<string, unknown> | null
  subscriptionStatus: string | null
  stripeSubscriptionId: string | null
}

export function isDemoTourCompany(input: {
  status?: string | null
  settings?: Record<string, unknown> | null
} | null): boolean {
  if (!input) return false
  if (input.status === 'demo') return true
  return input.settings?.['demo_tour'] === true
}

export function isPayingAccount(input: AccountPhaseInput): boolean {
  const { companyStatus, subscriptionStatus, stripeSubscriptionId } = input
  if (companyStatus === 'active') return true
  return subscriptionStatus === 'active' && !!stripeSubscriptionId
}

export function getAccountPhase(input: AccountPhaseInput): AccountPhase {
  if (input.companyStatus === 'suspended') return 'suspended'

  if (isPayingAccount(input)) return 'active'

  if (isDemoTourCompany({ status: input.companyStatus, settings: input.settings })) {
    return 'demo'
  }

  // Cuentas legacy en trial sin pago → tratarlas como demo
  if (input.companyStatus === 'trial' && !input.stripeSubscriptionId) {
    return 'demo'
  }

  return 'needs_plan'
}

export const BILLING_PATHS = ['/billing', '/suspended', '/settings/profile']

export function canAccessBillingOnly(pathname: string): boolean {
  return BILLING_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}
