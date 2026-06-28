# Análisis de arquitectura — TrackPro GPS

**Fecha de auditoría:** 17 de junio de 2026  
**Alcance:** Monorepo completo (web, gps-server, mobile, Supabase, packages)  
**Modo:** Solo lectura — sin cambios al código

---

## 1. Resumen ejecutivo

TrackPro GPS es un **SaaS multi-tenant** de rastreo vehicular orientado al mercado mexicano. La arquitectura actual es un **monolito de ingesta GPS** (Node.js + BullMQ) acoplado a **Supabase** (Postgres + Auth + Realtime) y un **frontend Next.js 14** desplegado en Vercel. El flujo principal — dispositivo Teltonika → posición en mapa — está operativo en producción (`trackprogps.mx`).

**Fortalezas:** separación ingesta/UI, colas asíncronas, RLS multi-tenant, particionado de historial, Realtime para mapa en vivo, billing Stripe, PWA + push.

**Debilidades estructurales:** protocolo único (Teltonika), monolito single-instance en Fly.io, escalado horizontal limitado por mapa de conexiones TCP en memoria, deuda técnica en build (TS/ESLint ignorados), trips no cableados, catálogo multi-marca solo en UI.

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                         │
│  Navegador (PWA) │ Expo Mobile │ Dispositivos Teltonika TCP :5000       │
└────────┬─────────────────┬──────────────────────────┬───────────────────┘
         │ HTTPS           │ Supabase direct           │ TCP binario
         ▼                 ▼                           ▼
┌─────────────────┐ ┌──────────────┐         ┌─────────────────────────┐
│  Next.js (web)  │ │ Expo mobile  │         │  gps-server (Fly.io)    │
│  Vercel         │ │ EAS builds   │         │  TCP + BullMQ + health  │
└────────┬────────┘ └──────┬───────┘         └───────────┬─────────────┘
         │                 │                             │
         └─────────────────┼─────────────────────────────┘
                           ▼
              ┌────────────────────────────┐
              │  Supabase                  │
              │  Auth │ Postgres │ Realtime│
              │  Edge Functions (email)    │
              └────────────┬───────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   Upstash Redis      Stripe            Resend / WhatsApp
   (BullMQ)           (billing)         / FCM / VAPID
         │
   Google Maps API (opcional)
   Anthropic Claude (asistente IA)
```

### 2.1 Monorepo (npm workspaces + Turbo 2)

| Workspace | Rol | Runtime |
|-----------|-----|---------|
| `apps/web` | Panel SaaS, APIs REST, PWA | Vercel / Node 20 |
| `apps/gps-server` | Ingesta TCP, workers, comandos | Fly.io (dfw) |
| `apps/mobile` | App Expo (mapa, alertas) | iOS/Android |
| `packages/types` | Tipos compartidos TypeScript | Build-time |

**Raíz:** `package.json` v1.0.0, Node ≥20, scripts de deploy/migración/seed en `scripts/`.

---

## 3. Backend — GPS Server

**Ubicación:** `apps/gps-server/`  
**Stack:** Node 20, TypeScript, BullMQ 5.7, ioredis 5.x, Supabase JS 2.43, Zod, ws, web-push.

### 3.1 Protocolos soportados (real vs declarado)

| Fabricante | UI / registro | Decoder en servidor |
|------------|---------------|---------------------|
| **Teltonika** | Sí | **Sí** — Codec 8, 8E (entrada), Codec 12 (comandos) |
| Queclink, Concox, etc. | Catálogo en `device-models.ts` | **No** |

**Handshake Teltonika:** paquete IMEI (15 dígitos) → ACK `0x01`.  
**Datos:** preamble, CRC16, registros con IO elements (ignición 239, odómetro, GSM, batería, combustible en raw_io).

### 3.2 Colas BullMQ

| Cola | Concurrencia worker | Retries | Función |
|------|---------------------|---------|---------|
| `gps-positions` | 30 | 3, exp 1s | Persistir posición, encolar alertas |
| `alert-checks` | 40 | 2, 500ms | Reglas, geocercas, insertar `alerts` |
| `notifications` | 10 | 5, exp 2s | Email, WhatsApp, FCM, Web Push |

**Degradación:** si Redis falla, procesamiento inline (sin cola).

### 3.3 Comandos remotos

- Web/API → `device_commands` (pending)
- `command-poller.ts` cada 3s (máx. 50)
- Envío Codec 12 por socket TCP activo en mapa `connections.ts` (in-memory por IMEI)

### 3.4 Infraestructura GPS

- **Fly.io:** `trackpro-gps-server`, región `dfw`, 2 vCPU shared, 2 GB RAM, `min_machines_running = 1`
- **Puertos:** TCP 5000 (dispositivos), HTTP 3001 (`/health`)
- **Docker:** multi-stage desde raíz del monorepo

---

## 4. Backend — Web (Next.js API)

**~45 rutas API** bajo `apps/web/src/app/api/`:

- **Auth:** register, signout, callback PKCE
- **Fleet:** vehicles, devices, drivers, geofences, vehicle-groups, history, trips
- **Ops:** alerts, alert-rules, maintenance, reports
- **Billing:** Stripe checkout/portal/webhooks, platform-stats
- **Admin:** users, companies, support tickets
- **Integraciones:** push-tokens, ai/chat, support/contact

**Patrón:** Route Handlers con `createSupabaseServerClient()` + validación Zod; operaciones privilegiadas con `createSupabaseServiceClient()`.

---

## 5. Frontend Web

**Next.js 14.2 App Router**, React 18, Tailwind, Zustand, TanStack Query.

### Módulos principales

| Módulo | Implementación |
|--------|----------------|
| **Login / registro** | Supabase Auth, invitaciones, activación, forgot/reset |
| **Dashboard** | KPIs, km stats RPC, mapa embebido |
| **Mapa en vivo** | Google Maps (`@vis.gl`) o Leaflet fallback; Realtime `vehicle_positions` |
| **Historial** | `RoutePlayback` — reproducción, colores por velocidad, tooltip sobre vehículo |
| **Geocercas** | Dibujo mapa + PostGIS RPC |
| **Alertas** | Lista + Realtime + reglas configurables |
| **Reportes** | Export CSV/PDF, RPC agregados |
| **Facturación** | Stripe, demo/trial/suspended gates |
| **Admin** | Empresas, usuarios internos, soporte (tickets) |
| **PWA** | SW push-only, manifest, instalación iOS/Android |
| **Legal** | Términos, privacidad, guía instaladores SIM |

### Roles y permisos

6 roles: `super_admin`, `admin_empresa`, `supervisor`, `operador`, `cliente_consulta`, `miembro_familiar`.

- **UI:** `PermissionsProvider`, `filterNavByRole`
- **API:** checks explícitos en rutas sensibles
- **DB:** RLS con `get_company_id()`, `user_can_access_vehicle()`
- **Gap:** `canAccessRoute()` definido pero **no usado** en middleware — RBAC parcialmente solo en navegación

---

## 6. Mobile (Expo)

**Expo 51**, Expo Router, Supabase directo (sin capa API intermedia).

- Tabs: dashboard, mapa, vehículos, alertas
- `react-native-maps`, push Expo
- **Menor superficie** que web: sin billing, admin, geocercas, reportes completos

---

## 7. Base de datos (Supabase Postgres)

Ver documento complementario en sección DB del mapa de sistema. Resumen:

- **Multi-tenant:** `companies` → `users`, `vehicles`, `gps_devices`
- **Hot path:** `vehicle_positions` (1 fila/vehículo, Realtime), `position_history` (particionado mensual)
- **PostGIS:** geocercas
- **RLS:** tenant + acceso por grupos de vehículos
- **Migraciones:** 001–024 (+ variantes `*b_fixed`)
- **Cron activo (018):** marcar dispositivos offline, limpieza historial >1 año
- **Cron comentado:** crear particiones mensuales, alertas mantenimiento/licencias

---

## 8. Integraciones externas

| Servicio | Uso |
|----------|-----|
| Supabase | Auth, DB, Realtime, Edge Functions |
| Vercel | Hosting web |
| Fly.io | GPS TCP server |
| Upstash Redis | BullMQ |
| Stripe | Suscripciones MXN |
| Resend | Email transaccional |
| Google Maps | Mapa web (opcional) |
| VAPID / web-push | PWA |
| WhatsApp / FCM | Notificaciones (gps-server) |
| Anthropic Claude | Asistente IA en dashboard |

---

## 9. Seguridad (visión arquitectónica)

- **Auth:** Supabase SSR cookies, email confirmation, PKCE callback
- **Autorización:** RLS + checks en API; service role solo en register, support, admin
- **Secrets:** `.env` raíz compartido; Fly secrets para gps-server; Vercel env para web
- **Webhooks:** Stripe con verificación de firma
- **Riesgos:** build sin type-check, register público con service role, views sin RLS, API keys en `api_keys` tabla

---

## 10. Rendimiento y escalabilidad (estado actual)

| Escala | Viabilidad con arquitectura actual |
|--------|----------------------------------|
| ~500–1 000 dispositivos | **Diseñado para esto** (migración 011) |
| 1 000–10 000 | Requiere batch inserts, partition cron, pooler, posiblemente más RAM en Fly |
| 10 000–100 000 | Requiere pipeline separado (Kafka/stream), TSDB, múltiples instancias con sticky TCP o gateway |
| 100 000–1 000 000 | **No viable** en Postgres+Supabase como único store de telemetría |

**Cuellos de botella identificados:**
- Dual write por punto GPS (upsert + insert)
- Realtime fan-out en `vehicle_positions`
- Geofence check O(n geocercas) por posición
- Monolito single-process (TCP + 80 workers concurrentes)
- Mapa conexiones TCP no compartido entre réplicas Fly

---

## 11. Inteligencia artificial (estado actual)

- **`/api/ai/chat`:** Claude con herramientas de consulta flota (vehículos, alertas)
- **Oportunidades no implementadas:** predicción consumo, detección anomalías, reportes NL, mantenimiento predictivo

---

## 12. Problemas encontrados

1. Protocolos GPS multi-marca solo en UI, no en servidor
2. `detect_trip_event()` definido pero no invocado; bug en cálculo odómetro en RPC
3. `trip_id` en types sin columna en DB
4. Particiones mensuales sin cron activo → riesgo de caída en partición default
5. TypeScript/ESLint deshabilitados en build producción web
6. RBAC de rutas incompleto (nav-only)
7. RLS inconsistente para `miembro_familiar` en geocercas/reglas
8. Documentación ARCHITECTURE.md desactualizada (concurrencia workers, Railway vs Fly)

---

## 13. Riesgos

| Riesgo | Severidad |
|--------|-----------|
| Single point of failure gps-server (1 máquina Fly) | Alta |
| Pérdida conexiones TCP al escalar horizontal | Alta |
| Crecimiento `position_history` sin DROP partition | Media-Alta |
| Abuso endpoint register | Media |
| Exposición datos vía Realtime si RLS mal configurado | Media |
| Dependencia vendor Supabase/Vercel/Fly | Media |

---

## 14. Mejoras recomendadas (prioridad arquitectónica)

1. Activar cron de particiones + retención por DROP partition
2. Cablear trips o eliminar código muerto
3. Habilitar type-check en CI/build
4. Middleware RBAC o guards uniformes en API
5. Abstracción `DeviceProtocol` para futuros codecs (móvil, Queclink)
6. Connection gateway / sticky sessions antes de multi-instancia Fly
7. Batch insert historial (COPY o RPC bulk)
8. Separar telemetría de metadata tenant a largo plazo (10k+ devices)

---

## 15. Tecnologías — matriz de versiones

| Componente | Versión / notas |
|------------|-----------------|
| Node.js | ≥20 |
| TypeScript | 5.4 |
| Turbo | 2.0 |
| Next.js | 14.2.3 |
| React | 18 |
| Expo | 51 |
| BullMQ | 5.7 |
| Supabase JS | 2.43 |
| Zod | 3.23 |
| Stripe | (web package.json) |
| PostGIS | Supabase extension |
| Vitest | 1.6 (gps-server tests Teltonika) |

---

*Documento generado por auditoría técnica. No implica cambios al sistema. Esperar instrucciones para fase de implementación.*
