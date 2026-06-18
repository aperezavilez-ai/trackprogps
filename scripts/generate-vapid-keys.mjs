/**
 * Genera claves VAPID para Web Push (PWA).
 * Uso: node scripts/generate-vapid-keys.mjs
 */
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('Añade a .env y Vercel:')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:alertas@trackprogps.mx')
