'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Headphones } from 'lucide-react'

export function SupportNavBadge({ initialCount = 0 }: { initialCount?: number }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/support/stats')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setCount(json.data?.nuevo ?? 0)
      } catch { /* ignore */ }
    }
    void load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (count <= 0) return null
  return (
    <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function SupportSidebarLink({
  collapsed,
  active,
  onNavigate,
  initialCount,
}: {
  collapsed: boolean
  active: boolean
  onNavigate: () => void
  initialCount?: number
}) {
  return (
    <Link
      href="/admin/support"
      onClick={onNavigate}
      title={collapsed ? 'Soporte' : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
        active
          ? 'bg-orange-500 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <Headphones className="w-4 h-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">Soporte</span>
          <SupportNavBadge initialCount={initialCount} />
        </>
      )}
    </Link>
  )
}
