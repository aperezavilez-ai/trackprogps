'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, Download, LogOut, User, ChevronDown, Settings, Shield, Plus, Menu, RefreshCw } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useAlertsRealtime } from '@/lib/context/alerts-realtime-context'
import { PanicButton } from '@/components/mobile/panic-button'

interface TopBarProps {
  profile: {
    full_name: string
    email: string
    role: string
    avatar_url: string | null
    company: { name: string; plan: { name: string } | null } | null
  }
}

const ROLE_LABELS: Record<string, string> = {
  super_admin:      'Dueño plataforma',
  admin_empresa:    'Administrador',
  supervisor:       'Supervisor',
  operador:         'Operador',
  cliente_consulta: 'Consulta',
  miembro_familiar: 'Miembro familiar',
}

export function TopBar({ profile }: TopBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createSupabaseBrowserClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeAlerts, setActiveAlerts] = useState(0)
  const isGeofencesPage = pathname === '/geofences'

  useEffect(() => {
    let cancelled = false
    fetch('/api/alerts?unacknowledged=true&per_page=1')
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setActiveAlerts(json.count ?? 0)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useAlertsRealtime(() => {
    setActiveAlerts(count => count + 1)
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile.full_name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 flex-shrink-0">
      {/* Left: breadcrumb placeholder */}
      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
          className="inline-flex lg:hidden w-9 h-9 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-medium text-gray-900 truncate">{profile.company?.name}</span>
        {profile.company?.plan && (
          <span className="hidden sm:inline bg-orange-50 text-orange-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {profile.company.plan.name}
          </span>
        )}
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {isGeofencesPage && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-geofence-modal'))}
            className="inline-flex items-center gap-1 sm:gap-2 bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva geocerca</span>
          </button>
        )}
        <Link
          href="/descargar"
          title="Instalar o descargar app"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-orange-600 hover:bg-orange-100 transition"
        >
          <Download className="w-4 h-4" />
          <span className="hidden xl:inline">Instalar app</span>
        </Link>
        <button
          type="button"
          title="Actualizar app"
          onClick={() => router.refresh()}
          className="hidden sm:inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden xl:inline">Actualizar app</span>
        </button>
        <PanicButton />
        {/* Notifications bell */}
        <Link
          href="/alerts"
          title={activeAlerts > 0 ? `${activeAlerts} alertas activas` : 'Ver alertas'}
          aria-label={activeAlerts > 0 ? `${activeAlerts} alertas activas` : 'Ver alertas'}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-500"
        >
          <Bell className="w-4 h-4" />
          {activeAlerts > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white text-center font-semibold">
              {activeAlerts > 9 ? '9+' : activeAlerts}
            </span>
          )}
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition"
          >
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-medium text-gray-900 leading-tight">{profile.full_name}</div>
              <div className="text-xs text-gray-500">{ROLE_LABELS[profile.role] ?? profile.role}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">{profile.email}</div>
                </div>
                <div className="py-1">
                  <Link href="/settings/profile" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <User className="w-4 h-4 text-gray-400" />
                    Mi perfil
                  </Link>
                  <Link href="/settings" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Settings className="w-4 h-4 text-gray-400" />
                    Configuración
                  </Link>
                  {['super_admin', 'admin_empresa'].includes(profile.role) && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Shield className="w-4 h-4 text-gray-400" />
                      Administradores y permisos
                    </Link>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
