import type { SupabaseClient } from '@supabase/supabase-js'

export type PositionIngestRow = {
  vehicle_id: string
  company_id: string
  device_id: string
  lat: number
  lng: number
  speed: number
  heading: number
  altitude?: number | null
  ignition: boolean
  odometer: number
  gsm_signal: number
  battery_lvl: number
  satellites?: number | null
  raw_io: Record<string, unknown>
  recorded_at: string
  server_at: string
}

export async function batchUpsertPositions(
  supabase: SupabaseClient,
  positions: PositionIngestRow[],
): Promise<{ processed: number }> {
  if (positions.length === 0) return { processed: 0 }

  const { data, error } = await supabase.rpc('batch_upsert_positions', {
    p_positions: positions,
  })

  if (error) throw error

  const result = data as { processed?: number } | null
  return { processed: result?.processed ?? positions.length }
}
