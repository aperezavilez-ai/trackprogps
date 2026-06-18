'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa/register-sw'

export function PwaRegistrar() {
  useEffect(() => {
    void registerServiceWorker()
  }, [])
  return null
}
