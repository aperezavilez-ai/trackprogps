export type MapStyle = 'hybrid' | 'satellite' | 'streets' | 'terrain'

export const MAP_STYLE_LABELS: Record<MapStyle, string> = {
  hybrid: 'Híbrido',
  satellite: 'Satélite',
  streets: 'Calles',
  terrain: 'Terreno',
}

/** Esri World Imagery - vista satelite realista (estilo ProTrack) */
export const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

/** Etiquetas de calles y lugares sobre satelite */
export const ESRI_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

/** Mapa de calles detallado */
export const ESRI_STREETS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'

export const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'

export const CARTO_LIGHT =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

export const CARTO_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO'
