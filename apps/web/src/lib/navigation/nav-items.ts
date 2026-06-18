import type { LucideIcon } from 'lucide-react'
import {
  MapPin, LayoutDashboard, Truck, Users, Radio,
  AlertTriangle, MapIcon, BarChart2, Wrench,
  Settings, CreditCard, Clock, Wallet, Shield,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  section: 'main' | 'fleet' | 'ops' | 'account'
  badge?: boolean
  adminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
  { href: '/map', label: 'Mapa en vivo', icon: MapIcon, section: 'main' },
  { href: '/drivers', label: 'Clientes', icon: Users, section: 'fleet' },
  { href: '/devices', label: 'Dispositivos', icon: Radio, section: 'fleet' },
  { href: '/vehicles', label: 'Vehículos', icon: Truck, section: 'fleet' },
  { href: '/geofences', label: 'Geocercas', icon: MapPin, section: 'fleet' },
  { href: '/alerts', label: 'Alertas', icon: AlertTriangle, section: 'ops', badge: true },
  { href: '/history', label: 'Historial', icon: Clock, section: 'ops' },
  { href: '/maintenance', label: 'Mantenimiento', icon: Wrench, section: 'ops' },
  { href: '/reports', label: 'Reportes', icon: BarChart2, section: 'ops' },
  { href: '/billing', label: 'Facturación', icon: CreditCard, section: 'account' },
  { href: '/billing?tab=pagos', label: 'Pagos', icon: Wallet, section: 'account' },
  { href: '/settings', label: 'Configuración', icon: Settings, section: 'account' },
  { href: '/admin/users', label: 'Administrador', icon: Shield, section: 'account', adminOnly: true },
]

export const NAV_SECTIONS = [
  { key: 'main' as const, label: null },
  { key: 'fleet' as const, label: 'Flota' },
  { key: 'ops' as const, label: 'Operaciones' },
  { key: 'account' as const, label: 'Cuenta' },
]
