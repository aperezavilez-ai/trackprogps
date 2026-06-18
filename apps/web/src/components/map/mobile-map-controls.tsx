'use client'

import { useState } from 'react'
import { Compass, Crosshair, Layers, Minus, Plus } from 'lucide-react'
import type { MapStyle } from '@/lib/map/tiles'

interface Props {
  mapStyle: MapStyle
  onChangeStyle: (style: MapStyle) => void
  onCenterSelected?: () => void
  onCenterFleet: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

const STYLES: Array<{ id: MapStyle; label: string }> = [
  { id: 'hybrid', label: 'Híbrido' },
  { id: 'satellite', label: 'Satélite' },
  { id: 'streets', label: 'Calles' },
]

export function MobileMapControls({
  mapStyle,
  onChangeStyle,
  onCenterSelected,
  onCenterFleet,
  onZoomIn,
  onZoomOut,
}: Props) {
  const [showStyles, setShowStyles] = useState(false)

  return (
    <div className="absolute right-3 top-20 z-[1100] flex flex-col gap-2 pointer-events-auto">
      {showStyles && (
        <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-lg p-1.5 flex flex-col gap-1">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                onChangeStyle(style.id)
                setShowStyles(false)
              }}
              className={`px-2.5 py-1.5 text-xs rounded-lg text-left ${
                mapStyle === style.id ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      )}

      <MapBtn icon={<Layers className="w-4 h-4" />} onClick={() => setShowStyles(v => !v)} title="Capas" />
      {onCenterSelected && <MapBtn icon={<Crosshair className="w-4 h-4" />} onClick={onCenterSelected} title="Centrar unidad" />}
      <MapBtn icon={<Compass className="w-4 h-4" />} onClick={onCenterFleet} title="Centrar flota" />
      <MapBtn icon={<Plus className="w-4 h-4" />} onClick={onZoomIn} title="Acercar" />
      <MapBtn icon={<Minus className="w-4 h-4" />} onClick={onZoomOut} title="Alejar" />
    </div>
  )
}

function MapBtn({
  icon,
  onClick,
  title,
}: {
  icon: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-12 h-12 rounded-2xl bg-white/95 backdrop-blur border border-gray-100 shadow-lg text-gray-700 hover:bg-white active:scale-95 transition flex items-center justify-center"
    >
      {icon}
    </button>
  )
}
