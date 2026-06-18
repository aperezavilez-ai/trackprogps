// ============================================================
// Poll Supabase for pending device commands and send via TCP
// ============================================================

import { createSupabaseServiceClient } from './lib/supabase.js'
import { getConnectionByImei } from './connections.js'
import { sendCommandToSocket } from './codecs/teltonika-commands.js'

const POLL_INTERVAL_MS = 3_000

export function startCommandPoller(): void {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    console.warn('[GPS] Command poller disabled — missing Supabase credentials')
    return
  }

  const supabase = createSupabaseServiceClient()

  async function poll() {
    try {
      const { data: commands, error } = await supabase
        .from('device_commands')
        .select('id, imei, command_text, command_type')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) {
        console.error('[GPS] Command poll error:', error.message)
        return
      }

      for (const cmd of commands ?? []) {
        const conn = getConnectionByImei(cmd.imei)
        if (!conn) {
          // Device offline — leave pending; expire after 10 min
          const { data: row } = await supabase
            .from('device_commands')
            .select('created_at')
            .eq('id', cmd.id)
            .single()

          if (row) {
            const age = Date.now() - new Date(row.created_at).getTime()
            if (age > 10 * 60 * 1000) {
              await supabase.from('device_commands').update({
                status: 'failed',
                error_msg: 'Dispositivo sin conexión TCP activa',
              }).eq('id', cmd.id)
            }
          }
          continue
        }

        const sent = sendCommandToSocket(conn.socket, cmd.command_text)
        if (sent) {
          await supabase.from('device_commands').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          }).eq('id', cmd.id)

          // Teltonika commands are fire-and-forget over Codec 12; mark confirmed after short delay
          setTimeout(async () => {
            await supabase.from('device_commands').update({
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
            }).eq('id', cmd.id).eq('status', 'sent')
          }, 5_000)

          console.log(`[GPS] Command sent to ${cmd.imei}: ${cmd.command_type}`)
        } else {
          await supabase.from('device_commands').update({
            status: 'failed',
            error_msg: 'Error al enviar por TCP',
          }).eq('id', cmd.id)
        }
      }
    } catch (err) {
      console.error('[GPS] Command poller exception:', err)
    }
  }

  setInterval(() => void poll(), POLL_INTERVAL_MS)
  void poll()
  console.log('[GPS] Command poller started')
}
