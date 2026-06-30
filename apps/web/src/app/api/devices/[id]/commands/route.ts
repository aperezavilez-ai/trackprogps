import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { firstOrNull } from '@/lib/supabase/normalize'
import { z } from 'zod'

const COMMAND_MAP: Record<string, string> = {
  immobilize:   'setdigout 1',
  enable:       'setdigout 0',
  get_position: 'getrecord',
  reboot:       'cpureset',
  microphone:   'call',
}

const CommandSchema = z.object({
  command_type: z.enum(['immobilize', 'enable', 'get_position', 'reboot', 'microphone']),
})

const MANAGE_ROLES = ['super_admin', 'admin_empresa', 'supervisor']

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('device_commands')
    .select('id, command_type, status, error_msg, created_at, sent_at, confirmed_at, issued_by_user:users!issued_by(full_name)')
    .eq('device_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !MANAGE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos para enviar comandos' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = CommandSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Comando inválido' }, { status: 422 })

  const { command_type } = parsed.data

  const { data: device } = await supabase
    .from('gps_devices')
    .select('id, imei, model, status, company_id, vehicle:vehicles(id)')
    .eq('id', params.id)
    .single()

  if (!device) return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })

  if (profile.role !== 'super_admin' && device.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const vehicle = firstOrNull(device.vehicle as { id: string } | { id: string }[] | null)

  // Safety: no immobilize while moving
  if (command_type === 'immobilize' && vehicle?.id) {
    const { data: pos } = await supabase
      .from('vehicle_positions')
      .select('speed')
      .eq('vehicle_id', vehicle.id)
      .single()

    if (pos && pos.speed > 2) {
      return NextResponse.json({
        error: `No se puede inmovilizar en movimiento (${Math.round(pos.speed)} km/h). Espera a que se detenga.`,
      }, { status: 422 })
    }
  }

  const isTeltonika = !device.model.toLowerCase().includes('queclink')
    && !device.model.toLowerCase().includes('concox')
    && !device.model.toLowerCase().includes('gt06')

  if (!isTeltonika) {
    return NextResponse.json({
      error: 'Comandos remotos solo disponibles para dispositivos Teltonika con relé instalado',
    }, { status: 422 })
  }

  const service = createSupabaseServiceClient()
  const { data: command, error } = await service
    .from('device_commands')
    .insert({
      company_id:   device.company_id,
      device_id:    device.id,
      vehicle_id:   vehicle?.id ?? null,
      imei:         device.imei,
      command_type,
      command_text: COMMAND_MAP[command_type],
      issued_by:    user.id,
      status:       'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: command,
    message: device.status === 'online'
      ? 'Comando en cola — se enviará al dispositivo en segundos'
      : 'Comando en cola — el dispositivo debe estar en línea para recibirlo',
  }, { status: 201 })
}
