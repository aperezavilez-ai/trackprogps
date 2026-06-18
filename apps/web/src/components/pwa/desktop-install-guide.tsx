'use client'

import { Monitor, Download } from 'lucide-react'

export function DesktopInstallGuide() {
  return (
    <div className="mt-4 space-y-3 text-left">
      <div className="rounded-xl bg-orange-500/10 border border-orange-400/25 px-3 py-2.5 text-xs text-orange-100 leading-relaxed">
        TrackPro GPS <strong>no descarga un archivo .exe</strong> como programas tradicionales.
        Es una app web que también puedes instalar en Chrome o Edge como acceso directo.
      </div>

      <p className="text-xs text-white/50 uppercase tracking-wide font-medium">Windows / Mac — Chrome o Edge</p>

      <ol className="space-y-2.5 text-sm text-white/85">
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span>
            Busca el icono <Download className="w-4 h-4 inline -mt-0.5 text-orange-400" /> o <strong>Instalar</strong> en la barra de direcciones (arriba a la derecha)
          </span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <span>
            O menú <strong>⋮</strong> → <strong>Instalar TrackPro GPS…</strong> / <strong>Instalar aplicación</strong>
          </span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">3</span>
          <span>
            Confirma — la app abrirá en su propia ventana con icono <Monitor className="w-4 h-4 inline -mt-0.5 text-orange-400" /> en el escritorio o menú Inicio
          </span>
        </li>
      </ol>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Si no ves la opción de instalar, usa TrackPro directamente en el navegador; funciona igual.
      </p>
    </div>
  )
}
