# Mapa del sistema — TrackPro GPS

**Propósito:** Describir cómo funciona cada módulo, relaciones entre componentes y flujos de información.  
**Auditoría:** 17 jun 2026 — solo lectura.

---

## 1. Vista de componentes

```
                    ┌──────────────────────────────────────┐
                    │           packages/types              │
                    │  UserRole, Vehicle, Alert, Position   │
                    └───────────────────┬──────────────────┘
                                        │ import
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────┐              ┌────────────────┐              ┌───────────────┐
│   apps/web    │◄──Realtime──►│   Supabase     │◄──service───►│ apps/gps-     │
│   Next.js     │◄──REST API──►│   Postgres     │              │ server        │
│   ~45 APIs    │              │   Auth         │◄──TCP jobs──►│ TCP + Workers │
└───────┬───────┘              │   Realtime     │              └───────┬───────┘
        │                      │   Edge Fn      │                      │
        │                      └────────┬───────┘                      │
        │                               │                              │
        ▼                               ▼                              ▼
   Usuario final                   Redis (BullMQ)              Dispositivo GPS
   PWA / Browser                   Stripe / Resend             Teltonika :5000
        │
        ▼
┌───────────────┐
│ apps/mobile   │
│ Expo Router   │──► Supabase directo (Auth + queries)
└───────────────┘
```

---

## 2. Módulos y responsabilidades

### 2.1 Autenticación y usuarios

| Componente | Archivos clave | Función |
|------------|----------------|---------|
| Middleware | `apps/web/src/middleware.ts` | Refresh sesión, redirect login/suspended |
| Login/Register | `(auth)/login`, `register`, `activar-cuenta` | Supabase Auth email/password |
| Callback | `auth/callback/route.ts` | PKCE OAuth/email confirm |
| Invitaciones | `api/settings/invite`, `send-invitation.ts` | Crear usuario + email activación |
| Admin usuarios | `admin/users`, `api/users/[id]` | CRUD, reenvío acceso |
| Mobile auth | `stores/auth-store.ts`, `auth-helpers.ts` | Sesión Supabase nativa |

**Flujo registro empresa:**
1. POST `/api/auth/register` → Auth user + `companies` + `users` (service role)
2. Email confirmación / activación
3. Trial según plan (`trial-status.ts`)
4. Stripe checkout si aplica

**Roles → permisos:** `lib/auth/permissions.ts`, `group-access.ts`, `scope.ts`

---

### 2.2 Empresas (multi-tenant)

| Tabla | Relación |
|-------|----------|
| `companies` | Raíz tenant: plan, Stripe, trial, CFDI |
| `users` | `company_id`, `role`, `account_type` |
| `vehicle_groups` | Sub-agrupación flota |
| `user_vehicle_groups` | Acceso granular (`miembro_familiar`) |

**Aislamiento:** RLS `company_id = get_company_id()` en tablas operativas.

---

### 2.3 Flota — vehículos, conductores, dispositivos

| Entidad | Tabla | UI / API |
|---------|-------|----------|
| Vehículo | `vehicles` | `/vehicles`, form modal, grupos |
| Conductor | `drivers` | `/drivers`, asignación unidad |
| Dispositivo GPS | `gps_devices` | `/devices`, wizard instalación |
| Posición actual | `vehicle_positions` | Mapa Realtime |
| Historial | `position_history` | `/history`, playback |
| Comandos | `device_commands` | `/api/devices/[id]/commands` |

**Cadena de vinculación:**
```
gps_devices (IMEI) ──► vehicles.device_id ──► vehicle_positions.vehicle_id
                                              position_history.vehicle_id
```

**Estado dispositivo:** `last_seen_at`, cron offline, señal en mapa.

---

### 2.4 Mapas

| Capa | Tecnología | Archivos |
|------|------------|----------|
| Mapa principal | Google Maps o Leaflet | `realtime-map.tsx`, `leaflet-realtime-map.tsx` |
| Marcadores | Cluster, heading, estado | `vehicle-marker-cluster.tsx`, `vehicle-marker.ts` |
| Tiles ProTrack | Custom | `protrack-tiles.tsx`, `lib/map/tiles.ts` |
| Historial ruta | Polyline + playback | `route-history-map.tsx`, `route-playback.tsx` |
| Geocercas | Dibujo + PostGIS | `geofence-draw-layer.tsx`, RPC `check_geofence_*` |
| Reverse geocode | API externa/cache | `reverse-geocode.ts` |
| Combustible estimado | Heurística distancia | `fuel-utils.ts` (10 L/100km default) |

**Flujo mapa en vivo:**
1. Cliente suscribe Realtime `vehicle_positions` filtrado por company
2. O polling `/api/vehicles` con última posición
3. Marcador actualizado; popup con velocidad, ignición, dirección

---

### 2.5 Historial y recorridos

| Paso | Detalle |
|------|---------|
| Query | GET `/api/history?vehicleId&from&to` |
| Fuente | `position_history` particionado |
| Enriquecimiento | `raw_io` → fuel %, GSM, batería, satélites |
| UI | `RoutePlayback`: interpolación, velocidades Lento/Rápido/Super rápido, tooltip sobre vehículo |
| Trips | Tabla `trips` + RPC `detect_trip_event` — **RPC no invocado desde gps-server** |

---

### 2.6 Geocercas

| Paso | Componente |
|------|------------|
| CRUD | `/api/geofences`, panel creación |
| Almacenamiento | `geofences.geometry` (PostGIS) |
| Evaluación | Alert worker → RPC geofence enter/exit |
| Alertas | Tipo `geofence_enter`, `geofence_exit` |

---

### 2.7 Alertas

```
Posición GPS ──► alert-checks queue ──► alert-worker.ts
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              alert_rules              geofence RPC              speed/ignition
              (por company)            (PostGIS)                 (thresholds)
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              ▼
                                        alerts (insert)
                                              │
                                              ▼
                                   notifications queue
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
                 Resend                   WhatsApp                    FCM / Web Push
              (Edge Fn alt.)            (gps-server)              (gps-server)
```

**Reglas:** `/api/alert-rules`, seed defaults, panel settings.  
**UI:** `/alerts`, Realtime, acknowledge.

---

### 2.8 Reportes

| Tipo | Mecanismo |
|------|-----------|
| Resumen flota | RPC `get_fleet_summary`, km stats |
| Historial export | CSV/PDF `export-report.ts` |
| Opciones | `/api/reports/options` |
| Billing admin | `/api/billing/platform-stats` |

---

### 2.9 Notificaciones

| Canal | Implementación |
|-------|----------------|
| Email | Resend (web + Edge Functions) |
| Push PWA | VAPID, `sw.js`, `/api/push-tokens` |
| Push mobile | Expo notifications |
| WhatsApp | Token en gps-server notification worker |
| FCM | Firebase en gps-server |
| Test | `/api/settings/test-notification` |

**Edge Functions:** `send-alert-notification`, `send-invitation-email`, `send-payment-failed-email`

---

### 2.10 Facturación

```
Usuario ──► /billing ──► Stripe Checkout ──► webhook ──► companies.stripe_*
                │
                ├── trial-status (gates UI)
                ├── suspended page
                └── CFDI settings (MX)
```

**Planes:** `subscription_plans`, `/api/plans/public`, `resolve-plan.ts`

---

### 2.11 Soporte (v1)

```
Footer modal ──► POST /api/support/contact ──► support_tickets
Admin /admin/support ──► tickets, reply ──► Resend email
Acceso: super_admin + equipo interno (support-access.ts)
```

---

### 2.12 Admin plataforma

| Ruta | Función |
|------|---------|
| `/admin` | Dashboard interno |
| `/admin/users` | Usuarios multi-empresa |
| `/admin/support` | Bandeja tickets |
| APIs | companies, users, platform-stats |

---

### 2.13 Asistente IA

```
Dashboard ──► AiAssistantProvider ──► POST /api/ai/chat
                                              │
                                              ▼
                                    Anthropic Claude + tools
                                    (consulta vehículos, alertas)
```

---

## 3. Flujo GPS end-to-end (Teltonika)

```
[1] Dispositivo conecta TCP :5000
         │
[2] Envía IMEI (15 bytes ASCII)
         │
[3] gps-server/index.ts valida, ACK 0x01, registra socket en connections.ts
         │
[4] Recibe paquete Codec 8/8E
         │
[5] teltonika.ts decode → N registros AVL
         │
[6] Por registro: enqueue gps-positions { imei, lat, lng, speed, heading, io, ts }
         │
[7] gps-worker.ts:
         ├── lookup gps_devices by IMEI
         ├── upsert vehicle_positions
         ├── insert position_history
         └── enqueue alert-checks
         │
[8] alert-worker.ts:
         ├── evaluar reglas + geocercas
         └── insert alerts → enqueue notifications
         │
[9] notification-worker.ts → email/push/WA
         │
[10] Supabase Realtime → clientes web/mobile actualizan mapa
```

**Comandos salientes (Codec 12):**
```
Web POST command ──► device_commands pending ──► command-poller ──► socket.write ──► dispositivo
```

---

## 4. Flujo web típico (usuario operador)

```
Login ──► middleware refresh ──► dashboard layout
                                      │
                    PermissionsProvider + TrialGate
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
           /map                  /vehicles                 /alerts
      Realtime pos            CRUD + groups            Realtime alerts
              │                       │                       │
              └───────────────────────┴───────────────────────┘
                                      │
                              Supabase (RLS)
```

---

## 5. Base de datos — mapa relacional simplificado

```
companies
  ├── users
  ├── vehicles ────── gps_devices (imei)
  │     ├── vehicle_positions (1:1 hot)
  │     ├── position_history (1:N, particionado)
  │     ├── trips
  │     └── maintenance_records
  ├── drivers
  ├── geofences
  ├── alert_rules
  ├── alerts
  ├── device_commands
  ├── vehicle_groups ── user_vehicle_groups
  ├── subscription / stripe refs
  └── support_tickets

auth.users ──► users.id (FK)
```

**Índices críticos:** `gps_devices.imei`, `vehicle_positions.vehicle_id`, `position_history(vehicle_id, recorded_at)`, geofence GIST.

---

## 6. Colas y procesos automáticos

| Proceso | Trigger | Acción |
|---------|---------|--------|
| GPS worker | Job BullMQ | Persist + alert queue |
| Alert worker | Job BullMQ | Reglas + geocercas |
| Notification worker | Job BullMQ | Multi-canal |
| Command poller | setInterval 3s | Comandos pending |
| Cron offline | pg_cron 018 | `last_seen_at` stale → offline |
| Cron cleanup | pg_cron 018 | Borrar historial >1 año |
| Cron particiones | **comentado** | Crear tablas mensuales |
| Stripe webhook | HTTP POST | Sync suscripción |

---

## 7. Integración futura — dispositivos móviles (diseño recomendado, no implementado)

```
App móvil ──HTTPS POST──► nueva API /api/telemetry/mobile
                              │
                              ├── Auth JWT (user/device token)
                              ├── Validar device_type = mobile_app
                              └── enqueue gps-positions (mismo job shape)
                                        │
                                        ▼
                              gps-worker (sin cambios Teltonika)
```

**Principios:**
- No tocar decoder TCP Teltonika
- Extender `gps_devices` con `source_type` / `device_type`
- Mismo pipeline posición → alertas → notificaciones
- Rate limit por dispositivo móvil

---

## 8. Dependencias entre servicios

| Si cae... | Impacto |
|-----------|---------|
| Supabase | Todo (auth, mapa, APIs) |
| Redis | GPS procesa inline; más latencia CPU |
| gps-server | Sin nuevas posiciones; mapa congela |
| Vercel | Web down; mobile parcial (Supabase directo) |
| Stripe | No nuevos checkouts; tracking sigue |
| Google Maps | Fallback Leaflet automático |

---

*Mapa de referencia para evolución del sistema. Sin modificaciones al código.*
