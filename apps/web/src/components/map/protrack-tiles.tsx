'use client'

import { TileLayer } from 'react-leaflet'
import { ESRI_ATTRIBUTION, ESRI_IMAGERY, ESRI_LABELS, ESRI_STREETS, type MapStyle } from '@/lib/map/tiles'

interface Props {
  style: MapStyle
}

export function ProTrackTiles({ style }: Props) {
  if (style === 'streets') {
    return (
      <TileLayer
        attribution={ESRI_ATTRIBUTION}
        url={ESRI_STREETS}
        maxZoom={19}
      />
    )
  }

  return (
    <>
      <TileLayer
        attribution={ESRI_ATTRIBUTION}
        url={ESRI_IMAGERY}
        maxZoom={19}
      />
      {style === 'hybrid' && (
        <TileLayer
          url={ESRI_LABELS}
          maxZoom={19}
          opacity={0.85}
        />
      )}
    </>
  )
}
