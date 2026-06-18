'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot } from 'lucide-react'
import { NAV_ITEMS, NAV_SECTIONS } from '@/lib/navigation/nav-items'
import { filterNavByRole } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils/cn'

interface Props {
  role: string
}

export function MobileMenuPage({ role }: Props) {
  const pathname = usePathname()
  const isAdmin = ['super_admin', 'admin_empresa'].includes(role)

  const items = NAV_ITEMS.filter(item => {
    if (!filterNavByRole(role, item.href)) return false
    if (item.href === '/billing' && !isAdmin) return false
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <div className="p-4 pb-8 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Menú</h1>
      <p className="text-sm text-gray-500 mb-6">Acceso rápido a todas las secciones</p>

      {NAV_SECTIONS.map(section => {
        const sectionItems = items.filter(i => i.section === section.key)
        if (!sectionItems.length) return null
        return (
          <div key={section.key} className="mb-6">
            {section.label && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {section.label}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {sectionItems.map(item => {
                const active = pathname === item.href || pathname.startsWith(`${item.href.split('?')[0]}/`)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition',
                      active
                        ? 'bg-orange-50 border-orange-200 text-orange-600'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300',
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
        className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium shadow-md"
      >
        <Bot className="w-5 h-5" />
        Asistente IA
      </button>
    </div>
  )
}
