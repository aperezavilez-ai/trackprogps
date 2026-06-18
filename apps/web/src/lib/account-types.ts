import type { AccountType } from '@gps-saas/types'

export const ACCOUNT_TYPES: {
  value: AccountType
  label: string
  description: string
  accountLabel: string
  accountPlaceholder: string
}[] = [
  {
    value: 'personal',
    label: 'Personal',
    description: '1–3 vehículos propios (auto, moto, pickup)',
    accountLabel: 'Nombre de tu cuenta',
    accountPlaceholder: 'Juan Pérez',
  },
  {
    value: 'family',
    label: 'Familiar',
    description: 'Varios vehículos de la familia (esposa, hijos, etc.)',
    accountLabel: 'Nombre de la familia',
    accountPlaceholder: 'Familia Pérez',
  },
  {
    value: 'business',
    label: 'Empresa / Flota',
    description: 'Flotilla comercial con múltiples unidades',
    accountLabel: 'Nombre de la empresa',
    accountPlaceholder: 'Transportes García S.A.',
  },
]

export function getAccountTypeConfig(type: AccountType) {
  return ACCOUNT_TYPES.find(t => t.value === type) ?? ACCOUNT_TYPES[2]!
}
