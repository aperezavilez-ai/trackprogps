# TrackProGPS Mobile — Rastreo por teléfono

Integración del módulo móvil dentro del ecosistema TrackProGPS (sin plataforma separada).

## Arquitectura

```
App Expo (Android/iOS)
  │  HTTPS + JWT Supabase
  ▼
/api/mobile/register   → gps_devices (source_type=mobile) + vehicles
/api/mobile/telemetry  → vehicle_positions + position_history + alertas
/api/mobile/events     → mobile_events + alerts (SOS, etc.)
  │
  ▼
Mismo mapa, historial, geocercas y notificaciones que GPS físico
```

**Teltonika / hardware:** sin cambios — TCP :5000 en `gps-server`.

## Tipos de dispositivo

| source_type | Identificación | Plataforma |
|-------------|----------------|------------|
| `hardware`  | IMEI 15 dígitos | Teltonika, Queclink, Concox, etc. |
| `mobile`    | `MOB-{device_uid}` | Android / iPhone vía app |

## API móvil

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/mobile/register` | Registra teléfono + vehículo vinculado |
| POST | `/api/mobile/telemetry` | Batch posiciones (max 100) |
| GET/PATCH | `/api/mobile/config` | Intervalo y activación |
| POST | `/api/mobile/events` | Eventos (SOS, batería, permisos…) |
| POST | `/api/mobile/sos` | Atajo emergencia |
| POST | `/api/mobile/check-in` | Check-in/out y evidencias |
| POST | `/api/mobile/location-share` | Enlace temporal |
| GET | `/api/mobile/dashboard` | Panel admin móviles |
| POST | `/api/mobile/sessions/revoke` | Cierre remoto |
| GET | `/api/share/location/[token]` | Ubicación pública compartida |

Autenticación: **misma sesión Supabase** — cookie web o `Authorization: Bearer` en app.

## App móvil (Expo 51)

- Tab **Rastreo**: activar GPS, intervalos 5s–5m, SOS, check-in, compartir
- Background: `expo-task-manager` + `expo-location`
- Offline: cola AsyncStorage → sync al reconectar
- Login: existente (`apps/mobile/src/app/login.tsx`)

### Variables

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_APP_URL=https://trackprogps.mx
```

### Build

```bash
cd apps/mobile
npm install
npm run build:android   # EAS
npm run build:ios
```

## Panel web

- **Flota → Móviles** (`/mobile`): dispositivos activos, batería, cierre remoto
- **Mapa**: filtros Todos / Vehículos / Móviles / Personal
- **Dispositivos**: filtro `?source_type=mobile`, registro admin con usuario asignado

## Migración

```bash
node scripts/apply-migrations-027.mjs
```

## Seguridad

- HTTPS obligatorio
- JWT validado por Supabase
- Sesiones móviles revocables
- Detección `mock_location` → alerta
- Rate limit implícito: max 100 puntos/request

## Pruebas

```bash
cd apps/web && npx vitest run src/lib/mobile/__tests__/schemas.test.ts
```

## Manual usuario (resumen)

1. Instalar **TrackProGPS Mobile**
2. Iniciar sesión con la misma cuenta web
3. Ir a **Rastreo** → **Activar rastreo** (aceptar permisos ubicación)
4. El teléfono aparece en el mapa web como unidad más
5. **SOS** envía alerta crítica inmediata

## Manual administrador

1. **Móviles** en sidebar: ver estado de flota móvil
2. **Dispositivos → Registrar móvil**: pre-asignar a usuario (Android/iPhone)
3. **Cerrar sesión remota**: pausa rastreo en el dispositivo
4. Historial y geocercas: igual que vehículos GPS
