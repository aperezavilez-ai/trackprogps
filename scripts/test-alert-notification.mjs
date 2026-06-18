/**
 * Prueba envío de notificación de alerta (email vía Resend directo).
 * Uso: node scripts/test-alert-notification.mjs [alert_id]
 */
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const alertId = process.argv[2]

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  'Content-Type': 'application/json',
}

let targetAlertId = alertId

if (!targetAlertId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/alerts?select=id,company_id,vehicle_id&order=created_at.desc&limit=1`, { headers })
  const rows = await res.json()
  if (!rows?.[0]) {
    console.error('No hay alertas en la base de datos')
    process.exit(1)
  }
  targetAlertId = rows[0].id
  console.log(`Usando alerta más reciente: ${targetAlertId}`)
}

const alertRes = await fetch(`${SUPABASE_URL}/rest/v1/alerts?id=eq.${targetAlertId}&select=id,company_id,vehicle_id,title`, { headers })
const [alert] = await alertRes.json()
if (!alert) {
  console.error('Alerta no encontrada')
  process.exit(1)
}

console.log(`Probando notificación: ${alert.title}`)

const resendKey = process.env.RESEND_API_KEY
if (!resendKey) {
  console.error('Falta RESEND_API_KEY en .env')
  process.exit(1)
}

const companyRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${alert.company_id}&select=name,email,settings`, { headers })
const [company] = await companyRes.json()
const toEmail = process.env.RESEND_TEST_TO ?? process.env.ADMIN_EMAIL ?? company?.settings?.notification_email ?? company?.email

if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
  console.error('Email de alertas inválido. Configura notification_email en Ajustes → Notificaciones')
  process.exit(1)
}

const emailRes = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${resendKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: process.env.RESEND_FROM_EMAIL ?? 'alertas@trackprogps.mx',
    to: [toEmail],
    subject: `[TEST] TrackPro GPS — ${alert.title}`,
    html: `<p>Prueba de notificación TrackPro GPS para alerta <strong>${alert.title}</strong>.</p><p>Si recibes esto, Resend está operativo.</p>`,
  }),
})

const body = await emailRes.text()
if (emailRes.ok) {
  console.log(`✅ Email de prueba enviado a ${toEmail}`)
} else {
  console.error(`❌ Resend error ${emailRes.status}:`, body.slice(0, 300))
  process.exit(1)
}
