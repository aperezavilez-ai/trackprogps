'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Map, Truck, AlertTriangle, Menu } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const TABS = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/map', label: 'Mapa', icon: Map },
  { href: '/drivers', label: 'Flota', icon: Truck },
  { href: '/alerts', label: 'Alertas', icon: AlertTriangle },
  { href: '/menu', label: 'Más', icon: Menu },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="grid grid-cols-5 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            pathname.startsWith(`${tab.href}/`) ||
            (tab.href === '/menu' && pathname === '/menu')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-[11px] font-medium transition',
                active ? 'text-orange-500 bg-orange-50' : 'text-gray-500'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
