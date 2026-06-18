export interface UnitDevice {
  id: string
  imei: string
  model: string
  status: string
  last_seen: string | null
}

export interface UnitVehicle {
  id: string
  economic_num: string
  plates: string
  brand: string
  model: string
  status?: string
  device: UnitDevice | null
}

export interface DriverWithUnits {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  license_num: string
  license_exp: string
  is_active: boolean
  units: UnitVehicle[]
  unit_count: number
  online_count: number
}

export function normalizeDriverRow(row: Record<string, unknown>): DriverWithUnits {
  const vehicles = row['vehicles']
  const vehicleList = (Array.isArray(vehicles) ? vehicles : vehicles ? [vehicles] : []) as Array<{
    id: string
    economic_num: string
    plates: string
    brand: string
    model: string
    status?: string
    device: UnitDevice | UnitDevice[] | null
  }>

  const units: UnitVehicle[] = vehicleList.map(v => {
    const dev = Array.isArray(v.device) ? v.device[0] : v.device
    return {
      id: v.id,
      economic_num: v.economic_num,
      plates: v.plates,
      brand: v.brand,
      model: v.model,
      status: v.status,
      device: dev ?? null,
    }
  })

  const online_count = units.filter(u => u.device?.status === 'online').length

  const { vehicles: _, ...rest } = row
  return {
    ...(rest as Omit<DriverWithUnits, 'units' | 'unit_count' | 'online_count'>),
    units,
    unit_count: units.length,
    online_count,
  }
}
