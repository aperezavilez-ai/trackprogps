'use client'

import { Layers } from 'lucide-react'
import { MAP_STYLE_LABELS, type MapStyle } from '@/lib/map/tiles'

interface Props {
  style: MapStyle
  onChange: (style: MapStyle) => void
}

const STYLES: MapStyle[] = ['hybrid', 'satellite', 'streets']

export function MapStyleSwitcher({ style, onChange }: Props) {
  return (
    <div className="absolute bottom-6 right-4 z-[1000] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-500">
        <Layers className="w-3.5 h-3.5" />
        Vista del mapa
      </div>
      <div className="flex p-1 gap-0.5">
        {STYLES.map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap
              ${style === s
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {MAP_STYLE_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}
