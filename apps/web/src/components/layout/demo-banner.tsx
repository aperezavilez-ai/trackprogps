'use client'

import { Info } from 'lucide-react'

export function DemoBanner() {
  return (
    <div className="bg-amber-500 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-sm font-medium flex-shrink-0">
      <Info className="w-4 h-4 flex-shrink-0" />
      <span>MODO DEMO — Datos de ejemplo. Conecta Supabase para usar con datos reales.</span>
    </div>
  )
}
