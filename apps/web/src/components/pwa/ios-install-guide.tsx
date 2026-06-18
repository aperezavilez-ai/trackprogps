'use client'

import { Share, PlusSquare, Home } from 'lucide-react'

export function IosInstallGuide({ inAppBrowser }: { inAppBrowser: boolean }) {
  return (
    <div className="mt-5 space-y-3">
      {inAppBrowser && (
        <div className="rounded-xl bg-amber-500/15 border border-amber-400/30 px-3 py-2.5 text-xs text-amber-100">
          Abre esta página en <strong>Safari</strong> (menú ⋯ → “Abrir en Safari”). WhatsApp e Instagram no permiten instalar la app.
        </div>
      )}

      <p className="text-xs text-white/50 uppercase tracking-wide font-medium">iPhone / iPad — Safari</p>

      <ol className="space-y-2.5 text-sm text-white/85">
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span>
            Toca <Share className="w-4 h-4 inline -mt-0.5 text-orange-400" /> <strong>Compartir</strong> (barra inferior de Safari)
          </span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <span>
            Elige <PlusSquare className="w-4 h-4 inline -mt-0.5" /> <strong>Añadir a pantalla de inicio</strong>
          </span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">3</span>
          <span>
            Confirma con <strong>Añadir</strong> — verás el icono <Home className="w-4 h-4 inline -mt-0.5 text-orange-400" /> TrackPro en tu pantalla
          </span>
        </li>
      </ol>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Esta es la forma oficial de usar TrackPro en iPhone hoy. Abre la app desde el icono en tu pantalla de inicio.
      </p>
    </div>
  )
}
