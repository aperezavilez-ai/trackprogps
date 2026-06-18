/**
 * Muestra la configuración DNS y URLs que debes tener en Supabase/Stripe.
 * Ejecutar: node scripts/configure-domain.mjs
 */
const DOMAIN = 'trackprogps.mx'
const APP_URL = `https://${DOMAIN}`

console.log(`
═══════════════════════════════════════════════════════════
  TrackPro GPS — Configuración dominio ${DOMAIN}
═══════════════════════════════════════════════════════════

✅ VERCEL (ya configurado)
   • Dominio principal:  ${APP_URL}
   • www → redirige a:    ${APP_URL} (308)
   • Apex DNS (A):        216.150.1.1  ✓ verificado

📋 SUPABASE → Authentication → URL Configuration
   Site URL:
     ${APP_URL}

   Redirect URLs (añadir todas):
     ${APP_URL}/**
     https://www.${DOMAIN}/**
     https://trackprogps.vercel.app/**

📋 STRIPE → Webhooks (si usas pagos)
   Endpoint URL:
     ${APP_URL}/api/webhooks/stripe

📋 VARIABLES VERCEL (ya aplicadas)
   NEXT_PUBLIC_APP_URL = ${APP_URL}
   NEXT_PUBLIC_APP_NAME = TrackPro GPS

🔗 URLs de la app
   Login:     ${APP_URL}/login
   Dashboard: ${APP_URL}/dashboard

⚠️  DNS opcional para www (recomendado)
   En tu registrador de ${DOMAIN}, añade:
   Tipo: CNAME | Nombre: www | Valor: abc6a68eec4765c4.vercel-dns-016.com

═══════════════════════════════════════════════════════════
`)
