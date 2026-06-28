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
    description: '1 vehículo incluido — puedes agregar más después (auto, moto, pickup)',
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
    label: 'Empresarial',
    description: 'Flotilla comercial con múltiples unidades y operadores',
    accountLabel: 'Nombre de la empresa',
    accountPlaceholder: 'Transportes García S.A.',
  },
]

/** Opciones visibles en el registro público (sin tipo Familiar) */
export const REGISTER_ACCOUNT_TYPES = ACCOUNT_TYPES.filter(t => t.value !== 'family')

export function getAccountTypeConfig(type: AccountType) {
  return ACCOUNT_TYPES.find(t => t.value === type) ?? ACCOUNT_TYPES.find(t => t.value === 'business')!
}
