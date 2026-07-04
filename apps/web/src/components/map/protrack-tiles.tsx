'use client'

import { TileLayer } from 'react-leaflet'
import {
  CARTO_ATTRIBUTION,
  CARTO_LIGHT,
  ESRI_ATTRIBUTION,
  ESRI_IMAGERY,
  ESRI_LABELS,
  ESRI_STREETS,
  type MapStyle,
} from '@/lib/map/tiles'

interface Props {
  style: MapStyle
}

export function ProTrackTiles({ style }: Props) {
  if (style === 'streets' || style === 'terrain') {
    return (
      <>
        <TileLayer
          attribution={CARTO_ATTRIBUTION}
          url={CARTO_LIGHT}
          maxZoom={22}
          maxNativeZoom={20}
          detectRetina
          zIndex={1}
        />
        <TileLayer
          attribution={ESRI_ATTRIBUTION}
          url={ESRI_STREETS}
          maxZoom={22}
          maxNativeZoom={19}
          detectRetina
          zIndex={2}
        />
      </>
    )
  }

  return (
    <>
      <TileLayer
        attribution={CARTO_ATTRIBUTION}
        url={CARTO_LIGHT}
        maxZoom={22}
        maxNativeZoom={20}
        detectRetina
        zIndex={1}
      />
      <TileLayer
        attribution={ESRI_ATTRIBUTION}
        url={ESRI_IMAGERY}
        maxZoom={22}
        maxNativeZoom={19}
        detectRetina
        zIndex={2}
      />
      {style === 'hybrid' && (
        <>
          <TileLayer
            url={ESRI_STREETS}
            maxZoom={22}
            maxNativeZoom={19}
            detectRetina
            opacity={0.26}
            zIndex={3}
          />
          <TileLayer
            url={ESRI_LABELS}
            maxZoom={22}
            maxNativeZoom={19}
            detectRetina
            opacity={0.95}
            zIndex={4}
          />
        </>
      )}
    </>
  )
}
