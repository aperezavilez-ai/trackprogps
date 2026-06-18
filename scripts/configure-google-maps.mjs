/**
 * Instrucciones para configurar Google Maps en trackprogps.mx
 * Ejecutar: node scripts/configure-google-maps.mjs
 */
console.log(`
═══════════════════════════════════════════════════════════
  Google Maps — Configuración para trackprogps.mx
═══════════════════════════════════════════════════════════

1. Ve a: https://console.cloud.google.com/google/maps-apis/credentials

2. Abre tu API Key (Maps JavaScript API)

3. En "Restricciones de aplicación" → "Referentes HTTP":
   Añade estos dominios:

     https://trackprogps.mx/*
     https://www.trackprogps.mx/*
     https://trackprogps.vercel.app/*
     http://localhost:3000/*

4. En "Restricciones de API" habilita:
   • Maps JavaScript API
   • Geocoding API (opcional)

5. Verifica que la facturación esté activa en el proyecto

6. (Opcional) Si quieres Map ID avanzado:
   • Crea un Map ID en Cloud Console
   • Añade NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID en Vercel

Variable en Vercel:
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = tu API key

Después de guardar en Google Cloud, espera 1-5 min y recarga:
  https://trackprogps.mx/dashboard

═══════════════════════════════════════════════════════════
`)
