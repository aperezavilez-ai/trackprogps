'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMapPage = pathname === '/map'

  return (
    <main
      className={cn(
        'min-h-0 flex-1 overflow-auto pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0',
        isMapPage && 'overflow-hidden p-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:p-0 lg:pb-0'
      )}
    >
      {children}
    </main>
  )
}
