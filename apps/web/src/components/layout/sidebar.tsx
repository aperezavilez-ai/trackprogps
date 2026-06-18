'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MapPin, Bot, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { filterNavByRole } from '@/lib/auth/permissions'
import { NAV_ITEMS, NAV_SECTIONS } from '@/lib/navigation/nav-items'

interface SidebarProps {
  profile: {
    role: string
    company: {
      name: string
      logo_url: string | null
      plan: { name: string; features: Record<string, boolean> } | null
    } | null
  }
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const features = profile.company?.plan?.features ?? {}
  const isAdmin = ['super_admin', 'admin_empresa'].includes(profile.role)

  useEffect(() => {
    const onToggle = () => setMobileOpen(v => !v)
    const onClose = () => setMobileOpen(false)
    window.addEventListener('toggle-mobile-sidebar', onToggle)
    window.addEventListener('close-mobile-sidebar', onClose)
    return () => {
      window.removeEventListener('toggle-mobile-sidebar', onToggle)
      window.removeEventListener('close-mobile-sidebar', onClose)
    }
  }, [])

  const filteredItems = NAV_ITEMS.filter(item => {
    if (!filterNavByRole(profile.role, item.href)) return false
    if (item.href === '/billing' && !isAdmin) return false
    if ('adminOnly' in item && item.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <>
    <aside className={cn(
      'bg-gray-900 text-white flex flex-col transition-all duration-200 flex-shrink-0',
      'fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 h-16 border-b border-gray-800 flex-shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">TrackProGps</div>
            <div className="text-xs text-gray-400 truncate">
              {profile.role === 'super_admin' ? 'Plataforma' : (profile.company?.name ?? 'GPS')}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 pb-24 lg:pb-3">
        {NAV_SECTIONS.map(section => {
          const items = filteredItems.filter(i => i.section === section.key)
          if (!items.length) return null
          return (
            <div key={section.key} className="mb-4">
              {section.label && !collapsed && (
                <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {section.label}
                </div>
              )}
              {items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800',
                      collapsed && 'justify-center px-0'
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          )
        })}

        {/* AI Assistant link */}
        {(features['ai_assistant'] || profile.role === 'super_admin') && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
            className={cn(
              'w-full mx-2 mt-2 p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl cursor-pointer hover:from-blue-500 hover:to-purple-500 transition text-left',
              collapsed && 'p-2 flex justify-center'
            )}
          >
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-white flex-shrink-0" />
              {!collapsed && (
                <div>
                  <div className="text-xs font-semibold text-white">Asistente IA</div>
                  <div className="text-xs text-blue-200">Pregunta sobre tu flota</div>
                </div>
              )}
            </div>
          </button>
        )}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center h-10 border-t border-gray-800 text-gray-500 hover:text-white transition"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
    {mobileOpen && (
      <button
        type="button"
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={() => setMobileOpen(false)}
        aria-label="Cerrar menú"
      />
    )}
    </>
  )
}
