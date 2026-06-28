export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { DashboardMain } from '@/components/layout/dashboard-main'
import { PlanLimitBanner } from '@/components/layout/plan-limit-banner'
import { ExplorationBanner } from '@/components/layout/exploration-banner'
import { DemoGate } from '@/components/layout/demo-gate'
import { PushNotificationSetup } from '@/components/pwa/push-notification-setup'
import { PwaBootstrap } from '@/components/pwa/pwa-bootstrap'
import { AIAssistantProvider } from '@/components/ai/ai-assistant-provider'
import { PermissionsProvider } from '@/lib/context/permissions-context'
import { ExplorationProvider } from '@/lib/context/exploration-context'
import { DemoTour } from '@/components/onboarding/demo-tour'
import { Suspense } from 'react'
import { isDemoTourActive } from '@/lib/demo-data'
import { getAccountPhase } from '@/lib/billing/account-phase'
import { canAccessSupportInbox } from '@/lib/auth/support-access'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!user.email_confirmed_at) redirect('/login?error=unconfirmed')

  const { data: profile } = await supabase
    .from('users')
    .select('*, company:companies(name, logo_url, status, trial_ends_at, settings, email, plan:plans(name, type, features))')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.is_active === false) redirect('/login?error=inactive')

  let subscriptionStatus: string | null = null
  let stripeSubscriptionId: string | null = null
  const company = profile.company as {
    name: string
    logo_url: string | null
    status: string
    trial_ends_at: string | null
    settings: Record<string, unknown> | null
    email?: string | null
    plan: { name: string; type: string; features: Record<string, unknown> } | null
  } | null

  const showSupportInbox = canAccessSupportInbox({
    role: profile.role,
    company_id: profile.company_id,
    company: company ? { email: company.email, settings: company.settings as { platform_internal?: boolean } | null } : null,
  })

  let supportNewCount = 0
  if (showSupportInbox) {
    const service = createSupabaseServiceClient()
    const { count } = await service
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'nuevo')
    supportNewCount = count ?? 0
  }

  if (profile.company_id) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, stripe_subscription_id')
      .eq('company_id', profile.company_id)
      .maybeSingle()
    subscriptionStatus = sub?.status ?? null
    stripeSubscriptionId = sub?.stripe_subscription_id ?? null
  }

  const accountInput = {
    companyStatus: company?.status ?? null,
    settings: company?.settings ?? null,
    subscriptionStatus,
    stripeSubscriptionId,
  }

  const demoTour = isDemoTourActive(company)
  const accountPhase = getAccountPhase(accountInput)

  return (
    <PermissionsProvider role={profile.role}>
    <ExplorationProvider isDemoTour={demoTour}>
    <AIAssistantProvider>
      <PwaBootstrap />
      <DemoGate role={profile.role} {...accountInput} />
      <Suspense fallback={null}>
        <DemoTour />
      </Suspense>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar profile={profile} showSupportInbox={showSupportInbox} supportNewCount={supportNewCount} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar profile={profile} />
          <PushNotificationSetup />
          {profile.company_id && profile.role === 'admin_empresa' && (
            <ExplorationBanner role={profile.role} {...accountInput} />
          )}
          {profile.company_id && accountPhase === 'active' && (
            <PlanLimitBanner companyId={profile.company_id} />
          )}
          <DashboardMain>{children}</DashboardMain>
          <MobileBottomNav />
        </div>
      </div>
    </AIAssistantProvider>
    </ExplorationProvider>
    </PermissionsProvider>
  )
}
