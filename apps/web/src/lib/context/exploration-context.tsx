'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Link from 'next/link'
import { Compass, X } from 'lucide-react'

interface ExplorationContextValue {
  isDemoTour: boolean
  showDemoNotice: (title: string, description: string) => void
}

const ExplorationContext = createContext<ExplorationContextValue>({
  isDemoTour: false,
  showDemoNotice: () => {},
})

export function ExplorationProvider({
  isDemoTour,
  children,
}: {
  isDemoTour: boolean
  children: React.ReactNode
}) {
  const [notice, setNotice] = useState<{ title: string; description: string } | null>(null)

  const showDemoNotice = useCallback((title: string, description: string) => {
    setNotice({ title, description })
  }, [])

  const value = useMemo(
    () => ({ isDemoTour, showDemoNotice }),
    [isDemoTour, showDemoNotice],
  )

  return (
    <ExplorationContext.Provider value={value}>
      {children}
      {notice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-orange-600 mb-3">
              <Compass className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Modo demostración</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{notice.title}</h3>
            <p className="text-sm text-gray-600 mb-5">{notice.description}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Seguir explorando
              </button>
              <Link
                href="/billing?tab=suscripcion"
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-medium text-center hover:bg-orange-400"
              >
                Ver planes
              </Link>
            </div>
          </div>
        </div>
      )}
    </ExplorationContext.Provider>
  )
}

export function useExploration() {
  return useContext(ExplorationContext)
}
