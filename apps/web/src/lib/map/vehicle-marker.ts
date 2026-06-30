import L from 'leaflet'
import type { VehicleType } from '@gps-saas/types'

/** Azul = en marcha · Naranja = detenido · Gris = apagado */
export function getVehicleColor(speed: number, ignition: boolean) {
  if (!ignition) return '#94A3B8'
  if (speed > 2) return '#2563EB'
  return '#F97316'
}

type VehicleIconKind = 'car' | 'suv' | 'van' | 'truck' | 'bus' | 'moto'

const WHITE  = '#FFFFFF'
const INK    = '#0F172A'
const GLASS  = '#1E293B'
const WHEEL  = '#111827'
const TAIL   = '#DC2626'

export function vehicleTypeToIconKind(type?: VehicleType | string | null): VehicleIconKind {
  switch (type) {
    case 'sedan': return 'car'
    case 'suv':
    case 'pickup': return 'suv'
    case 'van': return 'van'
    case 'truck': return 'truck'
    case 'bus': return 'bus'
    case 'motorcycle': return 'moto'
    default: return 'car'
  }
}

function wheel(cx: number, cy: number, r = 3.8): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${WHEEL}" stroke="${WHITE}" stroke-width="1.4"/>`
}

function statusRing(color: string): string {
  return `<ellipse cx="24" cy="26" rx="17" ry="7" fill="${color}" opacity="0.28"/>`
}

/** Sedán — silueta clara vista superior, frente arriba */
function carSvg(statusColor: string, opacity: number, selected: boolean): string {
  const ring = selected
    ? `<circle cx="24" cy="22" r="22" fill="none" stroke="#2563EB" stroke-width="2.5"/>`
    : ''
  return `
    ${statusRing(statusColor)}
    ${ring}
    <ellipse cx="24" cy="36" rx="13" ry="4.5" fill="rgba(0,0,0,0.2)"/>
    <g opacity="${opacity}">
      <!-- carrocería -->
      <path d="M17 7 C14.5 7 13 9 12.5 11.5 L11.5 17 C11 19 11 25 11.5 27
        L12.5 32 C13 34.5 14.5 36.5 17 36.5 H31 C33.5 36.5 35 34.5 35.5 32
        L36.5 27 C37 25 37 19 36.5 17 L35.5 11.5 C35 9 33.5 7 31 7 Z"
        fill="${WHITE}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <!-- cofre -->
      <path d="M17 7 H31 L29.5 13 H18.5 Z" fill="${WHITE}" stroke="${INK}" stroke-width="1.2"/>
      <!-- parabrisas -->
      <path d="M18.5 13 H29.5 L28.5 17.5 H19.5 Z" fill="${GLASS}"/>
      <!-- techo -->
      <rect x="19.5" y="17.5" width="9" height="11" rx="2" fill="${GLASS}"/>
      <!-- cajuela -->
      <path d="M19 28.5 H29 L30 33 H18 Z" fill="${WHITE}" stroke="${INK}" stroke-width="1"/>
      <!-- luneta -->
      <path d="M20 28 H28 L27.5 31.5 H20.5 Z" fill="#334155"/>
      <!-- luces -->
      <rect x="13" y="33.5" width="3.5" height="2.5" rx="1" fill="${TAIL}"/>
      <rect x="31.5" y="33.5" width="3.5" height="2.5" rx="1" fill="${TAIL}"/>
      ${wheel(14, 12)} ${wheel(34, 12)} ${wheel(14, 32)} ${wheel(34, 32)}
    </g>
  `
}

function suvSvg(statusColor: string, opacity: number, selected: boolean): string {
  const ring = selected ? `<circle cx="24" cy="22" r="22" fill="none" stroke="#2563EB" stroke-width="2.5"/>` : ''
  return `
    ${statusRing(statusColor)} ${ring}
    <ellipse cx="24" cy="36" rx="14" ry="4.5" fill="rgba(0,0,0,0.2)"/>
    <g opacity="${opacity}">
      <path d="M15 6 C12 6 10 8.5 9.5 11 L8.5 17 C8 19.5 8 24.5 8.5 27 L9.5 33
        C10 35.5 12 38 15 38 H33 C36 38 38 35.5 38.5 33 L39.5 27 C40 24.5 40 19.5 39.5 17
        L38.5 11 C38 8.5 36 6 33 6 Z" fill="${WHITE}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M15 6 H33 L31.5 12 H16.5 Z" fill="${WHITE}"/>
      <path d="M16.5 12 H31.5 L30 16.5 H18 Z" fill="${GLASS}"/>
      <rect x="17.5" y="16.5" width="13" height="12" rx="2.5" fill="${GLASS}"/>
      <rect x="13" y="33" width="3.5" height="2.5" rx="1" fill="${TAIL}"/>
      <rect x="31.5" y="33" width="3.5" height="2.5" rx="1" fill="${TAIL}"/>
      ${wheel(13, 11)} ${wheel(35, 11)} ${wheel(13, 33)} ${wheel(35, 33)}
    </g>
  `
}

function vanSvg(statusColor: string, opacity: number, selected: boolean): string {
  const ring = selected ? `<circle cx="24" cy="22" r="22" fill="none" stroke="#2563EB" stroke-width="2.5"/>` : ''
  return `
    ${statusRing(statusColor)} ${ring}
    <ellipse cx="24" cy="36" rx="14" ry="4.5" fill="rgba(0,0,0,0.2)"/>
    <g opacity="${opacity}">
      <rect x="10" y="10" width="28" height="26" rx="3" fill="${WHITE}" stroke="${INK}" stroke-width="2.2"/>
      <rect x="12.5" y="12.5" width="23" height="8" rx="1.5" fill="${GLASS}"/>
      <rect x="12.5" y="23" width="23" height="10" rx="1.2" fill="${GLASS}" opacity="0.75"/>
      ${wheel(13, 34, 3.5)} ${wheel(35, 34, 3.5)}
    </g>
  `
}

function truckSvg(statusColor: string, opacity: number, selected: boolean): string {
  const ring = selected ? `<circle cx="24" cy="22" r="22" fill="none" stroke="#2563EB" stroke-width="2.5"/>` : ''
  return `
    ${statusRing(statusColor)} ${ring}
    <ellipse cx="24" cy="36" rx="14" ry="4.5" fill="rgba(0,0,0,0.2)"/>
    <g opacity="${opacity}">
      <path d="M7 14 H25 L29 18 H41 V34 H7 Z" fill="${WHITE}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="30" y="19" width="9" height="8" rx="1.2" fill="${GLASS}"/>
      ${wheel(12, 33)} ${wheel(22, 33)} ${wheel(36, 33)}
    </g>
  `
}

function busSvg(statusColor: string, opacity: number, selected: boolean): string {
  const ring = selected ? `<circle cx="24" cy="22" r="22" fill="none" stroke="#2563EB" stroke-width="2.5"/>` : ''
  return `
    ${statusRing(statusColor)} ${ring}
    <ellipse cx="24" cy="36" rx="14" ry="4.5" fill="rgba(0,0,0,0.2)"/>
    <g opacity="${opacity}">
      <rect x="9" y="7" width="30" height="29" rx="3.5" fill="${WHITE}" stroke="${INK}" stroke-width="2.2"/>
      <rect x="12" y="10" width="24" height="10" rx="1.5" fill="${GLASS}"/>
      <rect x="12" y="22" width="24" height="10" rx="1" fill="${GLASS}" opacity="0.7"/>
      ${wheel(14, 34, 3.5)} ${wheel(34, 34, 3.5)}
    </g>
  `
}

function motoSvg(statusColor: string, opacity: number, selected: boolean): string {
  const ring = selected ? `<circle cx="24" cy="22" r="22" fill="none" stroke="#2563EB" stroke-width="2.5"/>` : ''
  return `
    ${statusRing(statusColor)} ${ring}
    <ellipse cx="24" cy="36" rx="10" ry="4" fill="rgba(0,0,0,0.2)"/>
    <g opacity="${opacity}">
      <ellipse cx="24" cy="11" rx="6" ry="7.5" fill="${WHITE}" stroke="${INK}" stroke-width="2"/>
      <rect x="21" y="16" width="6" height="15" rx="2.5" fill="${WHITE}" stroke="${INK}" stroke-width="1.8"/>
      <ellipse cx="24" cy="19" rx="2.5" ry="4" fill="${GLASS}"/>
      ${wheel(24, 9, 4)} ${wheel(24, 31, 4)}
    </g>
  `
}

function buildVehicleSvgBody(
  kind: VehicleIconKind,
  statusColor: string,
  ignition: boolean,
  selected: boolean,
): string {
  const opacity = ignition ? 1 : 0.5
  const builders: Record<VehicleIconKind, () => string> = {
    car:   () => carSvg(statusColor, opacity, selected),
    suv:   () => suvSvg(statusColor, opacity, selected),
    van:   () => vanSvg(statusColor, opacity, selected),
    truck: () => truckSvg(statusColor, opacity, selected),
    bus:   () => busSvg(statusColor, opacity, selected),
    moto:  () => motoSvg(statusColor, opacity, selected),
  }
  return builders[kind]()
}

function vehicleSvgMarkup(opts: {
  kind: VehicleIconKind
  color: string
  heading: number
  size: number
  label?: string
  showLabel?: boolean
  ignition?: boolean
  selected?: boolean
}) {
  const { kind, color, heading, size, label, showLabel, ignition = true, selected = false } = opts
  const body = buildVehicleSvgBody(kind, color, ignition, selected)

  const labelHtml = showLabel && label
    ? `<div style="
        position:absolute;bottom:-20px;left:50%;
        transform:translateX(-50%) rotate(${-heading}deg);
        background:rgba(15,23,42,0.88);color:#fff;font-size:9px;font-weight:600;
        padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:96px;
        overflow:hidden;text-overflow:ellipsis;pointer-events:none;
      ">${label}</div>`
    : ''

  return `
    <div class="vehicle-marker-wrap" style="position:relative;width:${size}px;height:${size}px;">
      <div style="width:${size}px;height:${size}px;transform:rotate(${heading}deg);transform-origin:center center;">
        <svg viewBox="0 0 48 48" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          ${body}
        </svg>
      </div>
      ${labelHtml}
    </div>
  `
}

function vehicleSvgString(
  kind: VehicleIconKind,
  color: string,
  heading: number,
  size: number,
  ignition: boolean,
  selected: boolean,
): string {
  const body = buildVehicleSvgBody(kind, color, ignition, selected)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
    <g transform="rotate(${heading} 24 24)">${body}</g>
  </svg>`
}

/** Leaflet marker icon */
export function createVehicleIcon(opts: {
  color: string
  heading: number
  selected: boolean
  label?: string
  vehicleType?: VehicleType | string | null
  ignition?: boolean
}) {
  const { color, heading, selected, label, vehicleType, ignition = true } = opts
  const size = selected ? 60 : 52
  const kind = vehicleTypeToIconKind(vehicleType)

  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: vehicleSvgMarkup({ kind, color, heading, size, label, showLabel: selected, ignition, selected }),
    iconSize: [size, size + (selected ? 22 : 0)],
    iconAnchor: [size / 2, size / 2],
  })
}

/** Google Maps — SVG simple sin filtros (compatible con data URL) */
export function createGoogleVehicleIcon(opts: {
  color: string
  heading: number
  selected: boolean
  vehicleType?: VehicleType | string | null
  ignition?: boolean
}) {
  const size = opts.selected ? 60 : 52
  const kind = vehicleTypeToIconKind(opts.vehicleType)
  const svg = vehicleSvgString(
    kind,
    opts.color,
    opts.heading,
    size,
    opts.ignition ?? true,
    opts.selected,
  )

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}

/** HTML para AdvancedMarker de Google Maps */
export function createVehicleMarkerHtml(opts: {
  color: string
  heading: number
  selected: boolean
  vehicleType?: VehicleType | string | null
  ignition?: boolean
}) {
  const size = opts.selected ? 60 : 52
  const kind = vehicleTypeToIconKind(opts.vehicleType)
  return vehicleSvgMarkup({
    kind,
    color: opts.color,
    heading: opts.heading,
    size,
    ignition: opts.ignition ?? true,
    selected: opts.selected,
  })
}

export const FLEET_MAP_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

export function createDevicePinIcon(vehicleType?: VehicleType | string | null) {
  const kind = vehicleTypeToIconKind(vehicleType)
  const size = 52
  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: vehicleSvgMarkup({ kind, color: '#2563EB', heading: 0, size, ignition: true }),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function createClusterIcon(count: number) {
  return L.divIcon({
    className: 'vehicle-cluster-icon',
    html: `<div style="
      width:42px;height:42px;border-radius:50%;
      background:linear-gradient(145deg,#fff 0%,#E2E8F0 100%);
      color:#1E293B;font-weight:700;font-size:13px;
      display:flex;align-items:center;justify-content:center;
      border:2.5px solid #2563EB;box-shadow:0 3px 10px rgba(0,0,0,0.35);
    ">${count}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}
