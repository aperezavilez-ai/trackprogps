import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canWriteFleet } from '@/lib/auth/permissions'
import { z } from 'zod'

const DriverSchema = z.object({
  full_name:   z.string().min(2).max(150),
  phone:       z.string().max(20).nullable().optional(),
  email:       z.string().email().nullable().optional(),
  license_num: z.string().min(3).max(30).nullable().optional(),
  license_exp: z.string().nullable().optional(),
  notes:       z.string().max(500).nullable().optional(),
})

const VehicleSchema = z.object({
  economic_num: z.string().min(1).max(20),
  plates:       z.string().min(1).max(15),
  brand:        z.string().min(1).max(60),
  model:        z.string().min(1).max(60),
  year:         z.number().int().min(1900).max(2100),
  type:         z.enum(['sedan', 'suv', 'pickup', 'van', 'truck', 'bus', 'motorcycle', 'other']).default('sedan'),
  color:        z.string().max(30).nullable().optional(),
  max_speed:    z.number().int().min(60).max(300).default(120),
  group_id:     z.string().uuid().nullable().optional(),
  owner_name:   z.string().max(150).nullable().optional(),
  notes:        z.string().max(1000).nullable().optional(),
})

const DeviceSchema = z.object({
  imei:         z.string().length(15).regex(/^\d+$/),
  model:        z.string().min(1).max(50),
  firmware_ver: z.string().max(20).nullable().optional(),
  sim_iccid:    z.string().max(30).nullable().optional(),
  phone_num:    z.string().max(20).nullable().optional(),
})

const NewGeofenceSchema = z.object({
  name:           z.string().min(1).max(100),
  type:           z.enum(['circular']).default('circular'),
  lat:            z.number(),
  lng:            z.number(),
  radius_m:       z.number().positive().default(500),
  color:          z.string().regex(/^#[0-9A-F]{6}$/i).default('#3B82F6'),
  alert_on_enter: z.boolean().default(true),
  alert_on_exit:  z.boolean().default(true),
})

const OnboardSchema = z.object({
  driver_id:      z.string().uuid().optional(),
  driver:         DriverSchema.optional(),
  vehicle:        VehicleSchema,
  device:         DeviceSchema,
  geofence_ids:   z.array(z.string().uuid()).optional(),
  new_geofence:   NewGeofenceSchema.optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canWriteFleet(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = OnboardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { driver_id, driver, vehicle, device, geofence_ids, new_geofence } = parsed.data

  if (!driver_id && !driver) {
    return NextResponse.json({ error: 'Se requiere driver_id o datos del cliente' }, { status: 422 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('account_type')
    .eq('id', profile.company_id)
    .single()

  const accountType = company?.account_type ?? 'business'
  const licenseRequired = accountType === 'business'

  if (!driver_id && driver) {
    if (licenseRequired && (!driver.license_num || !driver.license_exp)) {
      return NextResponse.json({ error: 'Licencia y vencimiento son obligatorios para cuentas empresariales' }, { status: 422 })
    }
  }

  let createdDriverId: string | null = null
  let createdDeviceId: string | null = null
  let createdVehicleId: string | null = null

  try {
    let finalDriverId = driver_id ?? null

    if (!finalDriverId && driver) {
      const { data: newDriver, error: driverError } = await supabase
        .from('drivers')
        .insert({
          full_name:   driver.full_name,
          phone:       driver.phone ?? null,
          email:       driver.email ?? null,
          license_num: driver.license_num ?? 'N/A',
          license_exp: driver.license_exp ?? new Date(Date.now() + 365 * 86400000 * 5).toISOString().slice(0, 10),
          notes:       driver.notes ?? null,
          company_id:  profile.company_id,
        })
        .select('id')
        .single()

      if (driverError) throw new Error('Error al crear cliente: ' + driverError.message)
      finalDriverId = newDriver.id
      createdDriverId = newDriver.id
    }

    if (!finalDriverId) throw new Error('Cliente no encontrado')

    const { data: newDevice, error: deviceError } = await supabase
      .from('gps_devices')
      .insert({
        ...device,
        company_id: profile.company_id,
        status:     'unknown',
      })
      .select('id')
      .single()

    if (deviceError) {
      if (deviceError.code === '23505') throw new Error('Ya existe un dispositivo con ese IMEI')
      throw new Error('Error al registrar GPS: ' + deviceError.message)
    }
    createdDeviceId = newDevice.id

    let groupId = vehicle.group_id ?? null
    if (!groupId) {
      const { data: defaultGroup } = await supabase
        .from('vehicle_groups')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('is_default', true)
        .maybeSingle()
      groupId = defaultGroup?.id ?? null
    }

    const { data: newVehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .insert({
        ...vehicle,
        company_id: profile.company_id,
        driver_id:  finalDriverId,
        device_id:  newDevice.id,
        group_id:   groupId,
        owner_name: vehicle.owner_name ?? null,
      })
      .select('id')
      .single()

    if (vehicleError) {
      if (vehicleError.code === '23505') throw new Error('Ya existe un vehículo con esas placas o número económico')
      throw new Error('Error al crear vehículo: ' + vehicleError.message)
    }
    createdVehicleId = newVehicle.id

    if (geofence_ids?.length) {
      for (const fenceId of geofence_ids) {
        const { data: fence } = await supabase
          .from('geofences')
          .select('vehicle_ids')
          .eq('id', fenceId)
          .single()

        if (!fence) continue
        if (fence.vehicle_ids === null) continue

        const ids = Array.isArray(fence.vehicle_ids) ? fence.vehicle_ids : []
        if (ids.includes(newVehicle.id)) continue

        await supabase
          .from('geofences')
          .update({ vehicle_ids: [...ids, newVehicle.id], updated_at: new Date().toISOString() })
          .eq('id', fenceId)
      }
    }

    if (new_geofence) {
      const geometry = {
        type: 'Point',
        coordinates: [new_geofence.lng, new_geofence.lat],
      }

      const { error: geoError } = await supabase.rpc('create_geofence', {
        p_company_id:    profile.company_id,
        p_name:          new_geofence.name,
        p_type:          new_geofence.type,
        p_geometry_json: JSON.stringify(geometry),
        p_radius_m:      new_geofence.radius_m,
        p_color:         new_geofence.color,
        p_alert_enter:   new_geofence.alert_on_enter,
        p_alert_exit:    new_geofence.alert_on_exit,
        p_alert_dwell:   false,
        p_created_by:    user.id,
        p_vehicle_ids:   [newVehicle.id],
      })

      if (geoError) {
        const { error: insertError } = await supabase.from('geofences').insert({
          company_id:     profile.company_id,
          name:           new_geofence.name,
          type:           new_geofence.type,
          radius_m:       new_geofence.radius_m,
          color:          new_geofence.color,
          alert_on_enter: new_geofence.alert_on_enter,
          alert_on_exit:  new_geofence.alert_on_exit,
          is_active:      true,
          vehicle_ids:    [newVehicle.id],
          created_by:     user.id,
        })
        if (insertError) throw new Error('Error al crear geocerca: ' + insertError.message)
      }
    }

    await supabase.from('audit_logs').insert({
      company_id: profile.company_id,
      user_id:    user.id,
      action:     'client.onboard',
      table_name: 'vehicles',
      record_id:  newVehicle.id,
      new_values: { driver_id: finalDriverId, vehicle_id: newVehicle.id, device_id: newDevice.id },
    })

    return NextResponse.json({
      data: {
        driver_id:  finalDriverId,
        vehicle_id: newVehicle.id,
        device_id:  newDevice.id,
      },
    }, { status: 201 })

  } catch (err) {
    if (createdVehicleId) await supabase.from('vehicles').delete().eq('id', createdVehicleId)
    if (createdDeviceId) await supabase.from('gps_devices').delete().eq('id', createdDeviceId)
    if (createdDriverId) await supabase.from('drivers').delete().eq('id', createdDriverId)

    const message = err instanceof Error ? err.message : 'Error al completar instalación'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
