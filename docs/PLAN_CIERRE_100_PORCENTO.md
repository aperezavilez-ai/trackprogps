# Plan de Cierre al 100% — TrackPro GPS
**Generado:** Junio 2026  
**Base:** Análisis de auditoría (78% operacional actual)  
**Objetivo:** Resolver cada brecha identificada con tarea concreta, responsable y estimado de tiempo

---

## RESUMEN EJECUTIVO

El proyecto está al **78%**. El 22% restante se divide en:
- **8%** → Deuda técnica crítica (P0/P1) — bloquea escalar con confianza
- **9%** → Features incompletas (Trips UI, White Label, IA cuotas, app nativa)
- **5%** → Calidad operacional (tests, CI/CD, observabilidad)

**Tiempo total estimado para el 100%:** ~18–22 días de trabajo real (1–2 devs)

---

## BLOQUE 1 — CALIDAD DE BUILD (de 40% → 100%)
**Impacto:** Bugs silenciosos llegan a producción. El build actual ignora TS y ESLint.

### Tarea 1.1 — Activar TypeScript estricto en build
**Archivo:** `apps/web/next.config.js`
```js
// CAMBIAR esto:
typescript: { ignoreBuildErrors: true }

// POR esto:
typescript: { ignoreBuildErrors: false }
```
**Procedimiento:**
1. Ejecutar `npx tsc --noEmit` en `apps/web` → listar todos los errores
2. Corregirlos en orden (la mayoría son tipos `any` implícitos y props opcionales)
3. Activar `ignoreBuildErrors: false`
4. El build en Vercel fallará si hay errores TypeScript — esto es el comportamiento correcto

**Estimado:** 4–6 horas (dependiendo de cuántos errores arroje el primer run)

---

### Tarea 1.2 — Activar ESLint en build
**Archivo:** `apps/web/next.config.js`
```js
// CAMBIAR:
eslint: { ignoreDuringBuilds: true }

// POR:
eslint: { ignoreDuringBuilds: false }
```
**Procedimiento:**
1. Ejecutar `npx eslint src/` → listar warnings y errors
2. Corregir los `errors` (los `warnings` pueden quedar con un `// eslint-disable` comentado justificado)
3. Activar

**Estimado:** 2–3 horas

---

### Tarea 1.3 — Pipeline CI/CD con GitHub Actions
**Archivo nuevo:** `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit --project apps/web/tsconfig.json
      - run: npx tsc --noEmit --project apps/gps-server/tsconfig.json

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx eslint apps/web/src --max-warnings 0

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx vitest run
```
**Estimado:** 2 horas

---

## BLOQUE 2 — SEGURIDAD (de 45% → 90%)

### Tarea 2.1 — CSP Headers (Content Security Policy)
**Archivo:** `apps/web/next.config.js` en la función `headers()`

El `next.config.js` actual tiene 4 headers de seguridad pero falta CSP. Agregar:
```js
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://maps.gstatic.com https://maps.googleapis.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com",
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')
}
```
**Estimado:** 2 horas (incluye pruebas en dev para no romper Google Maps ni Stripe)

---

### Tarea 2.2 — Rate limit en endpoints críticos adicionales
El rate limit en `/api/auth/register` ya existe (5 req/hora por IP — correcto).  
Faltan estos endpoints:

| Endpoint | Límite sugerido |
|----------|----------------|
| `/api/auth/login` | 10 req / 15 min por IP |
| `/api/ai/chat` | 20 req / hora por usuario |
| `/api/v1/*` (API pública) | 100 req / min por API key |

**Procedimiento:** Aplicar `checkRateLimit()` del módulo existente `lib/security/rate-limit.ts` en cada route handler. El módulo ya está listo, solo falta usarlo.

**Estimado:** 3 horas

---

### Tarea 2.3 — Validar IMEI contra DB antes de aceptar conexión
**Archivo:** `apps/gps-server/src/index.ts` (línea ~80, tras identificar handshake)

Actualmente cualquier IMEI desconocido puede conectarse. Agregar validación:
```ts
// Tras identificar el IMEI, antes de aceptar datos:
const { data: device } = await supabase
  .from('devices')
  .select('id, is_active')
  .eq('imei', handshake.imei)
  .maybeSingle()

if (!device || !device.is_active) {
  console.warn(`[GPS] IMEI no registrado o inactivo: ${handshake.imei}`)
  socket.destroy()
  return
}
```
**Estimado:** 2 horas (incluir caché en memoria con TTL 5min para no saturar Supabase)

---

### Tarea 2.4 — Lockout temporal por intentos fallidos de login
**Archivo nuevo:** `apps/web/src/app/api/auth/login/route.ts`

Next.js con Supabase Auth delega el login al cliente, pero agregar un endpoint server-side permite rate limiting. Actualmente el login va directo al cliente Supabase sin pasar por el servidor Next.js.

**Procedimiento:**
1. Crear `POST /api/auth/login` que valide rate limit por IP y por email
2. Si 5 intentos fallidos en 10 min → bloquear ese email por 30 min (con Map en memoria o Redis)
3. Redirigir el formulario de login a este endpoint

**Estimado:** 4 horas

---

### Tarea 2.5 — Cuotas de IA por empresa
**Archivo:** `apps/web/src/app/api/ai/chat/route.ts` (o el equivalente)

Actualmente cualquier usuario consume la API de Claude sin límite por empresa.

**Procedimiento:**
1. Agregar campo `ai_tokens_used_month` en tabla `companies` (migration `034_ai_quotas.sql`)
2. En el endpoint del chat, verificar el plan de la empresa y bloquear si supera el límite mensual
3. Planes: Básico = 100 msgs/mes, Pro = 1000, Empresarial = ilimitado

**Estimado:** 3 horas

---

## BLOQUE 3 — FEATURES INCOMPLETAS (de media completitud → 100%)

### Tarea 3.1 — Módulo Trips cableado en UI ⭐ PRIORITARIO
**El API existe** (`/api/trips/route.ts` funcional), la tabla `trips` existe, pero **no hay página en dashboard**.

**Crear:**
- `apps/web/src/app/(dashboard)/trips/page.tsx` — lista paginada de viajes por vehículo
- `apps/web/src/components/trips/trips-table.tsx` — tabla con columnas: fecha, vehículo, chofer, km, duración, velocidad máx
- `apps/web/src/components/trips/trip-map-preview.tsx` — mini-mapa con ruta del viaje
- Agregar entrada al menú de navegación lateral

**Estimado:** 8 horas

---

### Tarea 3.2 — FCM Push nativo funcional
**Problema:** `FCM_SERVER_KEY` tiene valor placeholder "AAAA...".

**Procedimiento:**
1. Crear proyecto en Firebase Console → obtener Server Key real
2. Actualizar variable de entorno en Vercel y en `.env` local
3. Probar envío con `firebase-admin` SDK desde Edge Function `send-alert-notification`

**Estimado:** 2 horas (la infraestructura ya está; solo falta la key real)

---

### Tarea 3.3 — Cron de mantenimiento vehicular activo
**Verificar** en Supabase Dashboard → Database → pg_cron:
```sql
-- Verificar si el cron está activo:
SELECT * FROM cron.job;
```
Si el job de partición y mantenimiento no aparece, ejecutar manualmente la migration `026_partition_cron.sql`.

**Estimado:** 1 hora

---

### Tarea 3.4 — App Móvil nativa en tiendas
**Estado:** EAS configurado (`eas.json`), PWA funcional, pero sin publicación en stores.

**Pasos:**
1. **Android:** Crear cuenta Google Play Developer ($25 único) → `eas build --platform android --profile production` → subir AAB
2. **iOS:** Cuenta Apple Developer ($99/año) → `eas build --platform ios --profile production` → TestFlight → App Store
3. Implementar `expo-secure-store` en lugar de `AsyncStorage` para tokens (migración de 2 archivos)
4. Agregar `expo-device` para detección básica root/jailbreak

**Estimado:** 12 horas distribuidas en 2–3 días (incluye tiempos de build en EAS)

---

### Tarea 3.5 — SecureStorage en app móvil
**Archivo:** `apps/mobile/src/lib/supabase.ts` y `apps/mobile/src/stores/auth-store.ts`

```ts
// Cambiar AsyncStorage por SecureStore:
import * as SecureStore from 'expo-secure-store'

// En la configuración del cliente Supabase:
storage: {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
}
```
**Estimado:** 2 horas

---

### Tarea 3.6 — White Label (UI)
**Estado:** Feature documentada, feature flag en DB, pero sin UI de configuración.

**Crear:**
- `apps/web/src/app/(dashboard)/settings/white-label/page.tsx` — subpágina dentro de settings (solo plan Empresarial)
- Campos: logo empresa, color primario, nombre personalizado, dominio custom
- La lógica ya existe en DB (`companies.settings` JSONB); solo falta el formulario

**Estimado:** 6 horas

---

## BLOQUE 4 — ESCALABILIDAD Y DISPONIBILIDAD (de 60% → 85%)

### Tarea 4.1 — GPS Server: 2da instancia (eliminar SPOF)
**Archivo:** `apps/gps-server/fly.toml`

```toml
# Cambiar:
min_machines_running = 1

# Por:
min_machines_running = 2
```

**IMPORTANTE:** El GPS server guarda conexiones TCP en memoria (`connections.ts` usa `Map` local). Con 2 instancias, un dispositivo conectado a la instancia A no podrá recibir comandos enviados desde la instancia B.

**Solución para comandos remotos:**
- Publicar el comando en Redis (ya tienen Upstash) con clave `cmd:{imei}`
- Cada instancia tiene su `command-poller.ts` que ya lee de Redis — ya está implementado el patrón, solo falta verificar que el poller use pub/sub en lugar de polling por IMEI local

**Estimado:** 4 horas

---

### Tarea 4.2 — Límite de vehículos en carga de mapa
**Problema:** El mapa SSR carga toda la flota sin paginación.

**Archivo:** `apps/web/src/app/(dashboard)/map/page.tsx`

Agregar límite inicial + carga incremental:
```ts
// Cargar máximo 200 vehículos en SSR; el resto se carga bajo demanda
const { data: vehicles } = await supabase
  .from('vehicle_positions')
  .select('...')
  .eq('company_id', profile.company_id)
  .limit(200)  // ← agregar esto
```

**Estimado:** 2 horas

---

### Tarea 4.3 — Verificar y activar partición mensual de position_history
```sql
-- Ejecutar en Supabase SQL Editor:
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE 'position_history_%';

-- Si no hay particiones futuras, ejecutar manualmente:
SELECT create_position_partition(date_trunc('month', now() + interval '1 month'));
SELECT create_position_partition(date_trunc('month', now() + interval '2 month'));
```
**Estimado:** 30 minutos

---

## BLOQUE 5 — TESTS Y OBSERVABILIDAD (de 15% → 70%)

### Tarea 5.1 — Suite de tests básica (cobertura mínima)
**Estado actual:** 3 archivos de test en todo el proyecto.

**Tests a crear (prioridad):**

| Test | Archivo | Qué prueba |
|------|---------|-----------|
| `register.test.ts` | `apps/web/src/app/api/auth/register/` | Rate limit, validación de schema, respuesta 201 |
| `billing-webhook.test.ts` | `apps/web/src/app/api/billing/` | Firma Stripe, activación de suscripción |
| `geofence.test.ts` | `apps/web/src/app/api/geofences/` | Entrada/salida de geocerca |
| `gps-worker.test.ts` | `apps/gps-server/src/queue/` | Procesamiento de posición GPS |
| `permissions.test.ts` | `apps/web/src/lib/auth/` | RBAC por rol |

**Herramienta:** Vitest (ya instalado en el proyecto)

**Estimado:** 10 horas

---

### Tarea 5.2 — Observabilidad básica
**Implementar:**

1. **Error tracking:** Integrar Sentry (gratis hasta 10k errores/mes)
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```

2. **Alertas operativas:** Configurar alerta en Fly.io si la instancia GPS cae
   - Fly.io → Monitoring → Add alert → HTTP check fails → email/Slack

3. **Uptime check:** Usar Better Uptime (gratis) o UptimeRobot para:
   - `https://trackprogps.mx` (frontend)
   - `https://trackpro-gps-server.fly.dev/health` (GPS server)

**Estimado:** 3 horas

---

### Tarea 5.3 — Logs estructurados en GPS server
**Archivo:** `apps/gps-server/src/index.ts` y workers

Reemplazar `console.log/error` con un logger estructurado:
```bash
npm install pino pino-pretty
```
```ts
import pino from 'pino'
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })

// En vez de:
console.log(`[GPS] New connection: ${connId}`)
// Usar:
logger.info({ connId, event: 'new_connection' }, 'GPS connection established')
```
Esto permite filtrar logs por evento en Fly.io Logs.

**Estimado:** 3 horas

---

## BLOQUE 6 — OTROS PUNTOS ESPECÍFICOS

### Tarea 6.1 — Conekta (mencionado en README, no implementado)
**Decisión:** Dos opciones:
- **A) Remover la mención** del README si Stripe cubre todo el mercado objetivo → 30 min
- **B) Implementar Conekta** como pasarela alternativa para clientes mexicanos que pagan con OXXO/transferencia → 16 horas

**Recomendación:** Opción A a corto plazo. Conekta en roadmap Q4 si hay demanda real de clientes.

---

### Tarea 6.2 — Decoders para Queclink y Concox
**Estado:** Solo Teltonika tiene decoder real. La UI del catálogo multi-marca existe pero los dispositivos de otras marcas no pueden conectarse.

**Procedimiento:**
1. Crear `apps/gps-server/src/codecs/queclink.ts` con parser del protocolo GT06/GT02
2. Registrar en `apps/gps-server/src/protocols/registry.ts`
3. Agregar tests

**Estimado por protocolo:** 12 horas (Queclink), 10 horas (Concox)  
**Decisión:** Solo si hay clientes con esos dispositivos. No es bloqueante para lanzar.

---

### Tarea 6.3 — Historial de conversaciones IA en DB
**Crear migration** `034_ai_conversations.sql`:
```sql
CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
-- Política: solo usuarios de la misma empresa
```
**Estimado:** 2 horas

---

### Tarea 6.4 — Arreglar doble implementación Google Maps / Leaflet
**Problema:** Dos librerías de mapas en uso simultáneo (deuda de mantenimiento).

**Procedimiento:**
1. Identificar en qué páginas se usa cada una
2. Migrar Leaflet → Google Maps (o viceversa según licencia y costo)
3. Eliminar la dependencia no usada

**Estimado:** 6 horas

---

## TABLERO RESUMEN — SPRINT PLAN

### Sprint 1 (Días 1–4): LO CRÍTICO PRIMERO
| # | Tarea | Estimado | Resultado |
|---|-------|----------|-----------|
| 1 | Activar TS + ESLint en build | 8h | Build falla si hay bugs |
| 2 | CSP Headers | 2h | Seguridad frontend |
| 3 | Rate limit en login + AI | 3h | Sin abuso de APIs |
| 4 | Verificar particiones DB | 1h | No fallan inserts futuros |

### Sprint 2 (Días 5–9): FEATURES QUE FALTAN
| # | Tarea | Estimado | Resultado |
|---|-------|----------|-----------|
| 5 | Trips UI completo | 8h | Feature prometida operativa |
| 6 | FCM key real | 2h | Push nativo funcionando |
| 7 | IMEI validation en GPS server | 2h | Sin spoofing |
| 8 | Cuotas IA por empresa | 3h | Control de costos Claude |
| 9 | Lockout brute force login | 4h | Seguridad auth |

### Sprint 3 (Días 10–14): CALIDAD Y OBSERVABILIDAD
| # | Tarea | Estimado | Resultado |
|---|-------|----------|-----------|
| 10 | Tests suite básica | 10h | Cobertura mínima |
| 11 | Sentry + uptime monitoring | 3h | Alertas de caídas |
| 12 | CI/CD GitHub Actions | 2h | Pipeline automático |
| 13 | Logs estructurados GPS | 3h | Debugging en producción |

### Sprint 4 (Días 15–22): ESCALABILIDAD + MOBILE
| # | Tarea | Estimado | Resultado |
|---|-------|----------|-----------|
| 14 | GPS server 2 instancias | 4h | Sin SPOF |
| 15 | Límite vehículos en mapa | 2h | Mapa fluido con +500 |
| 16 | SecureStorage mobile | 2h | Tokens seguros |
| 17 | White Label UI | 6h | Feature Empresarial lista |
| 18 | App Store / Play Store | 12h | Canal nativo disponible |

---

## PORCENTAJE ESPERADO POR BLOQUE

| Bloque | Hoy | Al completar | Δ |
|--------|-----|-------------|---|
| Calidad de build | 40% | 95% | +55% |
| Seguridad | 45% | 90% | +45% |
| Features (Trips, White Label, IA) | 72% | 95% | +23% |
| Escalabilidad | 60% | 85% | +25% |
| Tests | 15% | 70% | +55% |
| Observabilidad | 45% | 88% | +43% |
| App Móvil nativa | 65% | 88% | +23% |
| **PROMEDIO GLOBAL** | **78%** | **~96%** | **+18%** |

> El 4% restante para llegar al 100% absoluto requiere: Conekta, protocolos adicionales (Queclink/Concox), tests E2E completos y auditoría de seguridad externa — ítems que se justifican en escala, no en arranque.

---

## RECOMENDACIÓN DE EJECUCIÓN

**Si tienes 1 desarrollador:** Ejecuta los sprints en orden. 22 días calendario.  
**Si tienes 2 desarrolladores:** Sprint 1+2 en paralelo, Sprint 3+4 en paralelo. 11–12 días.  
**Para lanzar YA con el menor riesgo posible:** Completa solo Sprint 1 (4 días) + Tarea 3.3 (particiones DB) y ya tienes un sistema sólido para los primeros 100 clientes.

El Sprint 4 (mobile nativa + white label) puede ir en producción como **v1.1** después del primer mes de operación real.
