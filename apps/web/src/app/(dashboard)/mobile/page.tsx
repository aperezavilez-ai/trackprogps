import { MobileDashboardClient } from '@/components/mobile/mobile-dashboard-client'

export const dynamic = 'force-dynamic'

export default function MobilePage() {
  return (
    <div className="p-6">
      <MobileDashboardClient />
    </div>
  )
}
