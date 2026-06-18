'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMapPage = pathname === '/map'

  return (
    <main
      className={cn(
        'flex-1 overflow-auto pb-16 lg:pb-0',
        isMapPage && 'overflow-hidden p-0 pb-16 lg:p-0'
      )}
    >
      {children}
    </main>
  )
}
