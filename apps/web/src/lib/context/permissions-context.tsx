'use client'

import { createContext, useContext, useMemo } from 'react'
import {
  canWriteFleet,
  canCommandDevices,
  canManageUsers,
  canManageBilling,
  canManageGroups,
  canAcknowledgeAlerts,
  isReadOnlyRole,
} from '@/lib/auth/permissions'

interface Permissions {
  role: string
  canWriteFleet: boolean
  canCommandDevices: boolean
  canManageUsers: boolean
  canManageBilling: boolean
  canManageGroups: boolean
  canAcknowledgeAlerts: boolean
  isReadOnly: boolean
}

const PermissionsContext = createContext<Permissions>({
  role: 'operador',
  canWriteFleet: false,
  canCommandDevices: false,
  canManageUsers: false,
  canManageBilling: false,
  canManageGroups: false,
  canAcknowledgeAlerts: true,
  isReadOnly: false,
})

export function PermissionsProvider({ role, children }: { role: string; children: React.ReactNode }) {
  const value = useMemo(() => ({
    role,
    canWriteFleet: canWriteFleet(role),
    canCommandDevices: canCommandDevices(role),
    canManageUsers: canManageUsers(role),
    canManageBilling: canManageBilling(role),
    canManageGroups: canManageGroups(role),
    canAcknowledgeAlerts: canAcknowledgeAlerts(role),
    isReadOnly: isReadOnlyRole(role),
  }), [role])

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
