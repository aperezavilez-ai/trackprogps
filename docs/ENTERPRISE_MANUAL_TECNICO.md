# TrackProGPS — Manual técnico (Enterprise)

**Audiencia:** Ingeniería, DevOps, integradores

---

## 1. Stack

| Capa | Tecnología | Versión |
|------|------------|---------|
| Runtime | Node.js | ≥20 |
| Web | Next.js | 14.2 |
| Mobile | Expo | 51 |
| DB | PostgreSQL + PostGIS | Supabase |
| Colas | BullMQ + Redis | Upstash |
| GPS | Fly.io | dfw |
| Web host | Vercel | — |
| IA | Anthropic Claude | API |

---

## 2. Estructura monorepo

```
apps/web/          → Panel + APIs
apps/gps-server/   → TCP Teltonika + workers
apps/mobile/       → Expo app
packages/types/    → TypeScript shared
supabase/          → Migraciones + Edge Functions
scripts/           → Deploy, migraciones, seed
docs/              → Documentación
```

---

## 3. Variables de entorno críticas

### Web (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
GOOGLE_MAPS_API_KEY
REDIS_URL
RESEND_API_KEY
NEXT_PUBLIC_APP_URL=https://trackprogps.mx
```

### GPS Server (Fly)

```
SUPABASE_SERVICE_ROLE_KEY
REDIS_URL
DATABASE_URL (opcional)
GPS_SERVER_PORT=5000
```

### Mobile (EAS)

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_APP_URL
```

---

## 4. Base de datos

### Migraciones

```bash
node scripts/apply-migrations-027.mjs   # ejemplo mobile
node scripts/run-migrations.mjs           # batch
```

### Tablas core

| Grupo | Tablas |
|-------|--------|
| Tenant | companies, users, subscriptions |
| Fleet | vehicles, drivers, gps_devices, vehicle_groups |
| Tracking | vehicle_positions, position_history (particionado) |
| Mobile | mobile_events, mobile_sessions, mobile_location_shares |
| Alerts | alert_rules, alerts, geofences |
| Enterprise (futuro) | ai_insights, automation_playbooks, telemetry_events |

### Particiones

- `position_history` mensual — cron `create-next-month-partition`
- Retención: 1 año (cron cleanup)

---

## 5. APIs principales

| Prefijo | Auth | Uso |
|---------|------|-----|
| `/api/vehicles`, `/api/devices` | Cookie Supabase | Web UI |
| `/api/mobile/*` | Bearer JWT | App móvil |
| `/api/ai/chat` | Cookie + plan | TrackPro AI |
| `/api/v1/*` (futuro) | X-API-Key | Partners |

Ver [`API.md`](./API.md) y [`ENTERPRISE_API_PUBLICA.md`](./ENTERPRISE_API_PUBLICA.md).

---

## 6. Workers y colas

| Cola | Worker | Concurrencia |
|------|--------|--------------|
| gps-positions | gps-worker | 30 |
| alert-checks | alert-worker | 40 |
| notifications | notification-worker | 10 |
| automation-triggers (futuro) | automation-engine | 20 |
| ai-reports (futuro) | ai-report-worker | 5 |

Mobile telemetry procesa inline en Next.js API (sin BullMQ).

---

## 7. Despliegue

Ver [`ENTERPRISE_GUIA_DESPLIEGUE.md`](./ENTERPRISE_GUIA_DESPLIEGUE.md).

Resumen:
```bash
# Web
cd apps/web && vercel --prod --yes

# GPS
npm run deploy:gps -- --deploy-only

# Migración
node scripts/apply-migrations-XXX.mjs
```

---

## 8. Observabilidad

| Servicio | Health |
|----------|--------|
| Web | Vercel deployment status |
| GPS | `flyctl status -a trackpro-gps-server` + `:3001/health` |
| DB | Supabase dashboard |
| Redis | Upstash metrics |

**Logs:** Fly logs, Vercel functions, Supabase logs.

**Métricas recomendadas (futuro):** queue depth, ingest lag, AI cost/company.

---

## 9. Desarrollo local

```bash
npm install
npm run dev                    # web + gps via scripts/dev.mjs
cd apps/mobile && npm start    # Expo
```

---

## 10. Testing

| Área | Comando |
|------|---------|
| Teltonika codec | `npm run test:gps` / vitest gps-server |
| Mobile schemas | vitest web lib/mobile |
| E2E (futuro) | Playwright dashboard |

---

## 11. Extensión enterprise

Al implementar fases enterprise:

1. Crear migración numerada
2. Tipos en `packages/types`
3. API route + RLS
4. UI component
5. Documentar en docs/
6. Deploy según área

---

*Manual técnico v1.0*
