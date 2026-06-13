import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
})

// System prompt: IA knows it has access to GPS platform data
const SYSTEM_PROMPT = `Eres un asistente inteligente de una plataforma GPS llamada TrackPro.
Tienes acceso a datos en tiempo real de la flota del cliente mediante herramientas.
Responde siempre en español, de forma concisa y precisa.
Cuando el usuario pregunte sobre vehículos, conductores o alertas, usa las herramientas disponibles para obtener datos reales.
No inventes información. Si no puedes obtener los datos, dilo claramente.`

// Tool definitions for Claude
const GPS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_vehicles_status',
    description: 'Obtiene el estado actual de todos los vehículos de la empresa. Úsala cuando el usuario pregunte sobre vehículos activos, velocidad, ubicación o estado general de la flota.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'online', 'offline', 'moving', 'stopped'],
          description: 'Filtro de estado de vehículos',
        },
      },
    },
  },
  {
    name: 'get_active_alerts',
    description: 'Obtiene las alertas activas (no reconocidas) de la empresa. Úsala cuando el usuario pregunte sobre alertas, incidentes o eventos.',
    input_schema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['all', 'critical', 'high', 'medium', 'low'],
        },
        limit: {
          type: 'number',
          description: 'Máximo número de alertas a retornar',
        },
      },
    },
  },
  {
    name: 'get_vehicle_location',
    description: 'Obtiene la ubicación actual de un vehículo específico por número económico o placas.',
    input_schema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'Número económico o placas del vehículo',
        },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'get_daily_km',
    description: 'Obtiene los kilómetros recorridos hoy por todos los vehículos o uno específico.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_identifier: {
          type: 'string',
          description: 'Opcional: número económico o placas. Si se omite, retorna total de la flota.',
        },
      },
    },
  },
]

type ToolInput = {
  filter?: string
  severity?: string
  limit?: number
  identifier?: string
  vehicle_identifier?: string
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company associated' }, { status: 403 })
  }

  // Check AI feature access
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan:plans(features)')
    .eq('company_id', profile.company_id)
    .single()

  const features = (sub?.plan as { features: { ai_assistant: boolean } } | null)?.features
  if (!features?.ai_assistant && profile.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'AI assistant is not available on your current plan' },
      { status: 402 }
    )
  }

  const { messages } = await request.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  const companyId = profile.company_id

  // Tool execution function
  async function executeTool(name: string, input: ToolInput): Promise<string> {
    switch (name) {
      case 'get_vehicles_status': {
        let query = supabase
          .from('vehicle_positions')
          .select(`
            vehicle_id,
            lat, lng, speed, heading, ignition,
            recorded_at,
            vehicle:vehicles(economic_num, plates, brand, model, driver:drivers(full_name))
          `)
          .eq('company_id', companyId)

        const { data } = await query
        if (!data?.length) return 'No hay vehículos con datos de posición disponibles.'

        const now = Date.now()
        const summary = data.map(p => {
          const isOnline = (now - new Date(p.recorded_at).getTime()) < 5 * 60 * 1000
          const v = p.vehicle as {
            economic_num: string
            plates: string
            brand: string
            model: string
            driver: { full_name: string } | null
          } | null
          return {
            economico: v?.economic_num ?? 'N/A',
            placas:    v?.plates ?? 'N/A',
            estado:    !isOnline ? 'sin señal' : !p.ignition ? 'apagado' : p.speed > 2 ? `en movimiento (${p.speed}km/h)` : 'detenido',
            conductor: v?.driver?.full_name ?? 'sin asignar',
            lat:       p.lat,
            lng:       p.lng,
          }
        })

        return JSON.stringify(summary, null, 2)
      }

      case 'get_active_alerts': {
        const limit = input.limit ?? 10
        let query = supabase
          .from('alerts')
          .select('type, severity, title, message, created_at')
          .eq('company_id', companyId)
          .is('acknowledged_at', null)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (input.severity && input.severity !== 'all') {
          query = query.eq('severity', input.severity)
        }

        const { data } = await query
        if (!data?.length) return 'No hay alertas activas en este momento.'
        return JSON.stringify(data, null, 2)
      }

      case 'get_vehicle_location': {
        const id = input.identifier?.toUpperCase() ?? ''
        const { data } = await supabase
          .from('vehicle_positions')
          .select(`
            lat, lng, speed, ignition, recorded_at,
            vehicle:vehicles!inner(economic_num, plates, brand, model)
          `)
          .eq('company_id', companyId)
          .or(`vehicle.economic_num.ilike.%${id}%,vehicle.plates.ilike.%${id}%`)
          .limit(1)
          .single()

        if (!data) return `No se encontró vehículo con identificador: ${input.identifier}`
        const v = data.vehicle as { economic_num: string; plates: string; brand: string; model: string } | null
        return `Vehículo ${v?.economic_num} (${v?.plates}) — ${v?.brand} ${v?.model}
Ubicación: lat ${data.lat}, lng ${data.lng}
Velocidad: ${data.speed} km/h | Ignición: ${data.ignition ? 'encendida' : 'apagada'}
Última actualización: ${new Date(data.recorded_at).toLocaleString('es-MX')}`
      }

      case 'get_daily_km': {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data } = await supabase
          .from('position_history')
          .select('vehicle_id, odometer, recorded_at, vehicle:vehicles(economic_num, plates)')
          .eq('company_id', companyId)
          .gte('recorded_at', today.toISOString())
          .order('vehicle_id, recorded_at')

        if (!data?.length) return 'No hay datos de kilometraje para hoy.'

        // Group by vehicle and calculate delta odometer
        const byVehicle = new Map<string, { first: number; last: number; name: string }>()
        for (const p of data) {
          const v = p.vehicle as { economic_num: string; plates: string } | null
          const name = v ? `${v.economic_num} (${v.plates})` : p.vehicle_id
          const existing = byVehicle.get(p.vehicle_id)
          if (!existing) {
            byVehicle.set(p.vehicle_id, { first: p.odometer, last: p.odometer, name })
          } else {
            existing.last = p.odometer
          }
        }

        const results = [...byVehicle.values()].map(v => ({
          vehiculo: v.name,
          km_hoy:   Math.round((v.last - v.first) * 10) / 10,
        }))

        const totalKm = results.reduce((sum, v) => sum + v.km_hoy, 0)
        return `Total flota hoy: ${totalKm.toFixed(1)} km\n\n` + JSON.stringify(results, null, 2)
      }

      default:
        return 'Herramienta no reconocida'
    }
  }

  // Run agentic loop with tool use
  const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role:    m.role,
    content: m.content,
  }))

  let response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    system:     SYSTEM_PROMPT,
    tools:      GPS_TOOLS,
    messages:   anthropicMessages,
  })

  // Agentic loop: keep executing tools until final response
  while (response.stop_reason === 'tool_use') {
    const toolUseBlock = response.content.find(b => b.type === 'tool_use') as
      Anthropic.ToolUseBlock | undefined

    if (!toolUseBlock) break

    const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input as ToolInput)

    anthropicMessages.push(
      { role: 'assistant', content: response.content },
      {
        role: 'user',
        content: [{
          type:        'tool_result',
          tool_use_id: toolUseBlock.id,
          content:     toolResult,
        }],
      }
    )

    response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      tools:      GPS_TOOLS,
      messages:   anthropicMessages,
    })
  }

  // Extract final text response
  const textBlock = response.content.find(b => b.type === 'text') as
    Anthropic.TextBlock | undefined

  return NextResponse.json({
    message: textBlock?.text ?? 'No pude generar una respuesta.',
  })
}
