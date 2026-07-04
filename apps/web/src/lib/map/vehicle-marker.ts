import L from 'leaflet'
import type { DeviceSourceType, VehicleType } from '@gps-saas/types'

/** Azul = en marcha · Naranja = detenido · Gris = apagado */
export function getVehicleColor(speed: number, ignition: boolean) {
  if (!ignition) return '#94A3B8'
  if (speed > 2) return '#2563EB'
  return '#F97316'
}

type VehicleIconKind = 'car' | 'suv' | 'van' | 'truck' | 'bus' | 'moto' | 'mobile'
const CAR_TOP_IMAGE_URL = '/images/vehicle-car-top.png?v=2026070339'

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

function vehicleAssetToIconKind(
  _type?: VehicleType | string | null,
  deviceSource?: DeviceSourceType | string | null,
): VehicleIconKind {
  if (deviceSource === 'mobile') return 'mobile'
  return 'car'
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
    <ellipse cx="24" cy="37" rx="15" ry="5" fill="rgba(0,0,0,0.24)"/>
    <g opacity="${opacity}">
      <path d="M12 32.5 L13.7 22.2 L16.8 12.5 C17.7 9.7 20 7.8 22.9 7.8 H25.1
        C28 7.8 30.3 9.7 31.2 12.5 L34.3 22.2 L36 32.5
        C36.3 34.7 34.6 36.7 32.4 36.7 H15.6 C13.4 36.7 11.7 34.7 12 32.5 Z"
        fill="${WHITE}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M18 13.2 C18.7 11 20.3 9.8 22.6 9.8 H25.4 C27.7 9.8 29.3 11 30 13.2
        L31.7 18.2 H16.3 Z" fill="${statusColor}" opacity="0.95" stroke="${INK}" stroke-width="1.2"/>
      <path d="M16.3 18.2 H31.7 L30.5 25.2 H17.5 Z" fill="${GLASS}"/>
      <path d="M18 25.2 H30 L31.1 33.5 H16.9 Z" fill="#F8FAFC" stroke="${INK}" stroke-width="1"/>
      <path d="M20 26.3 H28 L28.8 31.3 H19.2 Z" fill="#334155"/>
      <path d="M13.5 22.5 L17 20.5" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M34.5 22.5 L31 20.5" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="14.1" y="33.1" width="4.2" height="2.6" rx="1" fill="${TAIL}"/>
      <rect x="29.7" y="33.1" width="4.2" height="2.6" rx="1" fill="${TAIL}"/>
      ${wheel(13.5, 15, 3.6)} ${wheel(34.5, 15, 3.6)} ${wheel(13.5, 32.8, 3.9)} ${wheel(34.5, 32.8, 3.9)}
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

function mobileSvg(statusColor: string, opacity: number, selected: boolean): string {
  const ring = selected ? `<circle cx="24" cy="22" r="22" fill="none" stroke="#2563EB" stroke-width="2.5"/>` : ''
  return `
    ${statusRing(statusColor)} ${ring}
    <ellipse cx="24" cy="38" rx="10" ry="4.5" fill="rgba(0,0,0,0.22)"/>
    <g opacity="${opacity}">
      <path d="M24 4 C16.8 4 11 9.8 11 17 C11 27.2 24 42.5 24 42.5 C24 42.5 37 27.2 37 17 C37 9.8 31.2 4 24 4 Z"
        fill="${statusColor}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="18" y="10" width="12" height="19" rx="2.4" fill="${WHITE}" stroke="${INK}" stroke-width="1.7"/>
      <rect x="20" y="13" width="8" height="11.5" rx="1" fill="#DBEAFE"/>
      <circle cx="24" cy="26.8" r="1.2" fill="${INK}"/>
      <path d="M21 31.5 C21.8 30 22.8 29.2 24 29.2 C25.2 29.2 26.2 30 27 31.5"
        fill="none" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/>
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
    mobile: () => mobileSvg(statusColor, opacity, selected),
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
  if (kind === 'car') {
    return carImageMarkup({ color, heading, size, label, showLabel, ignition, selected })
  }

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

function carImageMarkup(opts: {
  color: string
  heading: number
  size: number
  label?: string
  showLabel?: boolean
  ignition: boolean
  selected: boolean
}) {
  const { color, heading, size, label, showLabel, ignition, selected } = opts
  const opacity = ignition ? 1 : 0.92
  const carWidth = Math.round(size * 1.28)
  const carHeight = Math.round(size * 0.62)
  const selectedRing = selected
    ? `<div style="
        position:absolute;inset:${Math.round(size * 0.06)}px;
        border:3px solid #2563EB;border-radius:999px;
        box-shadow:0 0 0 2px rgba(255,255,255,0.9);
      "></div>`
    : ''
  const labelHtml = showLabel && label
    ? `<div style="
        position:absolute;bottom:-20px;left:50%;
        transform:translateX(-50%) rotate(${-heading}deg);
        background:rgba(15,23,42,0.88);color:#fff;font-size:9px;font-weight:600;
        padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:112px;
        overflow:hidden;text-overflow:ellipsis;pointer-events:none;
      ">${label}</div>`
    : ''

  return `
    <div class="vehicle-marker-wrap vehicle-marker-car" style="position:relative;width:${size}px;height:${size}px;">
      <div style="
        position:absolute;left:50%;top:50%;width:${Math.round(size * 0.9)}px;height:${Math.round(size * 0.38)}px;
        transform:translate(-50%,-34%) rotate(${heading}deg);
        transform-origin:center center;
        border-radius:999px;background:${color};opacity:0.22;filter:blur(1px);
      "></div>
      ${selectedRing}
      <div style="
        position:absolute;left:50%;top:50%;
        width:${carWidth}px;height:${carHeight}px;
        transform:translate(-50%,-50%) rotate(${heading}deg);
        transform-origin:center center;
        display:flex;align-items:center;justify-content:center;
      ">
        <img src="${CAR_TOP_IMAGE_URL}" alt="" draggable="false" style="
          width:100%;height:100%;object-fit:contain;opacity:${opacity};
          filter:drop-shadow(0 4px 5px rgba(15,23,42,0.38));
          pointer-events:none;user-select:none;
        " />
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
  deviceSource?: DeviceSourceType | string | null
  ignition?: boolean
}) {
  const { color, heading, selected, label, vehicleType, deviceSource, ignition = true } = opts
  const size = selected ? 60 : 52
  const kind = vehicleAssetToIconKind(vehicleType, deviceSource)
  const markerHeading = kind === 'mobile' ? 0 : heading

  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: vehicleSvgMarkup({ kind, color, heading: markerHeading, size, label, showLabel: selected, ignition, selected }),
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
  deviceSource?: DeviceSourceType | string | null
  ignition?: boolean
}) {
  const size = opts.selected ? 60 : 52
  const kind = vehicleAssetToIconKind(opts.vehicleType, opts.deviceSource)
  if (kind === 'car') {
    const icon: {
      url: string
      scaledSize?: google.maps.Size
      anchor?: google.maps.Point
    } = { url: CAR_TOP_IMAGE_URL }
    const maps = globalThis.google?.maps
    const width = Math.round(size * 1.28)
    const height = Math.round(size * 0.62)
    if (typeof maps?.Size === 'function') icon.scaledSize = new maps.Size(width, height)
    if (typeof maps?.Point === 'function') icon.anchor = new maps.Point(width / 2, height / 2)
    return icon
  }

  const svg = vehicleSvgString(
    kind,
    opts.color,
    kind === 'mobile' ? 0 : opts.heading,
    size,
    opts.ignition ?? true,
    opts.selected,
  )

  const icon: {
    url: string
    scaledSize?: google.maps.Size
    anchor?: google.maps.Point
  } = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  }

  const maps = globalThis.google?.maps

  if (typeof maps?.Size === 'function') {
    icon.scaledSize = new maps.Size(size, size)
  }

  if (typeof maps?.Point === 'function') {
    icon.anchor = new maps.Point(size / 2, size / 2)
  }

  return icon
}

/** HTML para AdvancedMarker de Google Maps */
export function createVehicleMarkerHtml(opts: {
  color: string
  heading: number
  selected: boolean
  vehicleType?: VehicleType | string | null
  deviceSource?: DeviceSourceType | string | null
  ignition?: boolean
}) {
  const size = opts.selected ? 60 : 52
  const kind = vehicleAssetToIconKind(opts.vehicleType, opts.deviceSource)
  return vehicleSvgMarkup({
    kind,
    color: opts.color,
    heading: kind === 'mobile' ? 0 : opts.heading,
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

export function createDevicePinIcon(
  vehicleType?: VehicleType | string | null,
  deviceSource?: DeviceSourceType | string | null,
) {
  const kind = vehicleAssetToIconKind(vehicleType, deviceSource)
  const color = kind === 'mobile' ? '#F97316' : '#2563EB'
  const size = 52
  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: vehicleSvgMarkup({ kind, color, heading: 0, size, ignition: true }),
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
