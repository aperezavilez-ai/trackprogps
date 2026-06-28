'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { SupportContactModal } from './support-contact-modal'

type Source = 'login' | 'register' | 'descargar' | 'other'

interface SupportContactContextValue {
  openSupport: (source?: Source) => void
}

const SupportContactContext = createContext<SupportContactContextValue | null>(null)

export function SupportContactProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<Source>('other')

  const openSupport = useCallback((s: Source = 'other') => {
    setSource(s)
    setOpen(true)
  }, [])

  return (
    <SupportContactContext.Provider value={{ openSupport }}>
      {children}
      <SupportContactModal open={open} source={source} onClose={() => setOpen(false)} />
    </SupportContactContext.Provider>
  )
}

export function useSupportContact() {
  const ctx = useContext(SupportContactContext)
  if (!ctx) {
    return {
      openSupport: (_source?: Source) => {
        window.location.href = 'mailto:soporte@trackprogps.mx'
      },
    }
  }
  return ctx
}
