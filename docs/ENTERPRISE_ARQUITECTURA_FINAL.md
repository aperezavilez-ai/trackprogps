# TrackProGPS — Arquitectura final (target enterprise)

**Estado:** Target architecture — evolución incremental desde producción actual

---

## 1. Diagrama consolidado

```
                         ┌─────────────────────────────────────┐
                         │           CLIENTES                   │
                         │ Web │ Mobile │ GPS │ API partners    │
                         └──────────────┬──────────────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────────────┐
│                              VERCEL (Edge/CDN)                                 │
│  Next.js 14 — UI, REST API, TrackPro AI, Analytics, Playbooks admin           │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ▼                               ▼                               ▼
┌───────────────┐              ┌────────────────┐              ┌──────────────┐
│  Fly.io GPS   │              │ Upstash Redis  │              │  Supabase    │
│  Teltonika    │──BullMQ─────►│ gps-positions  │              │  Postgres    │
│  TCP :5000    │              │ alert-checks   │◄────────────►│  Auth        │
└───────────────┘              │ automation     │              │  Realtime    │
        │                      │ ai-reports     │              │  Storage     │
        │ HTTPS                └────────────────┘              │  Edge Fn     │
        ▼                               │                      └──────────────┘
┌───────────────┐                       │                               │
│ Mobile ingest │───────────────────────┘                               │
│ /api/mobile   │                                                       │
└───────────────┘                                                       │
                                                                        │
┌───────────────────────────────────────────────────────────────────────▼───────┐
│                         SERVICIOS EXTERNOS                                     │
│ Anthropic (AI) │ Stripe │ Resend │ Google Maps │ Expo Push │ Webhooks        │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│                    CAPA ANALÍTICA (evolutiva)                                  │
│ Materialized views → Timescale/ClickHouse (500k+) → Data lake (1M+)           │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes y responsabilidades

| Componente | Repo path | Responsabilidad |
|------------|-----------|-----------------|
| Web app | `apps/web` | UI, API REST, IA, analytics, admin |
| GPS server | `apps/gps-server` | Teltonika TCP, workers hardware |
| Mobile app | `apps/mobile` | Rastreo + flota viewer |
| Types | `packages/types` | Contratos compartidos |
| Supabase | `supabase/` | Schema, RLS, migrations, edge |
| Docs | `docs/` | Especificaciones |

---

## 3. Flujos de datos unificados

### Posición GPS (hardware)
`Teltonika → gps-server → BullMQ → Postgres → Realtime → Mapa`

### Posición móvil
`Expo → /api/mobile/telemetry → Postgres → Realtime → Mapa`

### IoT (futuro)
`Teltonika IO / BLE → telemetry_events → alert/playbook/analytics`

### Inteligencia
`Usuario NL → TrackPro AI → tools (RLS) → respuesta`
`Cron → anomaly job → ai_insights → alert opcional`

### Automatización
`Evento → automation-triggers queue → playbook engine → acciones`

---

## 4. Multi-tenancy

- **Aislamiento:** RLS `company_id = get_company_id()`
- **Planes:** `subscriptions` + `plans.features`
- **White label:** `companies.settings.branding` + dominio custom
- **Super admin:** plataforma sin `company_id`

---

## 5. Decisiones arquitectónicas (ADRs resumen)

| ID | Decisión | Razón |
|----|----------|-------|
| ADR-01 | Monorepo Turbo | Shared types, deploy coordinado |
| ADR-02 | Supabase central | Auth+DB+RT integrado; escala con réplica/TSDB |
| ADR-03 | Mobile vía HTTPS API | No tocar decoder Teltonika |
| ADR-04 | IA read-only layer | No bloquear ingesta |
| ADR-05 | Playbooks sobre alert_rules | Evolución sin breaking change |
| ADR-06 | API v1 separada | Keys + rate limit sin afectar cookies web |

---

## 6. Compatibilidad garantizada

| Módulo | Contrato estable |
|--------|------------------|
| Teltonika Codec 8/8E/12 | `apps/gps-server/src/codecs/teltonika.ts` |
| Mobile API v1 | `/api/mobile/*` |
| Web auth | Supabase cookies |
| Realtime | `vehicle_positions` channel |
| Planes | Stripe webhooks existentes |

---

*Arquitectura viva — actualizar al cerrar cada fase de implementación.*
