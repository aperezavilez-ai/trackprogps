'use client'

import { Smartphone, MoreVertical } from 'lucide-react'

export function AndroidInstallGuide() {
  return (
    <div className="mt-4 space-y-3 text-left">
      <p className="text-xs text-white/50 uppercase tracking-wide font-medium">Android — Chrome</p>

      <ol className="space-y-2.5 text-sm text-white/85">
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span>
            Toca el botón <strong>Instalar app</strong> arriba, o el menú <MoreVertical className="w-4 h-4 inline -mt-0.5" /> <strong>⋮</strong>
          </span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <span>
            Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>
          </span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">3</span>
          <span>
            Abre TrackPro desde el icono <Smartphone className="w-4 h-4 inline -mt-0.5 text-orange-400" /> en tu teléfono
          </span>
        </li>
      </ol>
    </div>
  )
}
