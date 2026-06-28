# TrackProGPS Enterprise — Automatización, API y Escala

**Fases:** 7 (Automatización) · 8 (Multi-tenant/White label) · 9 (API pública) · 10 (Escalabilidad)

---

## Fase 7 — Motor de automatización (Playbooks)

### 7.1 Estado actual vs objetivo

| Hoy | Objetivo |
|-----|----------|
| `alert_rules` por tipo fijo | Playbooks SI/ENTONCES composables |
| Evaluación en cada posición | Triggers múltiples (evento, horario, IA) |
| Acciones: alert + notify | + webhook, comando, ticket, reporte |

### 7.2 Modelo Playbook

```json
{
  "name": "Zona restringida nocturna",
  "trigger": { "type": "geofence_enter", "geofence_id": "..." },
  "conditions": [
    { "type": "time_window", "start": "22:00", "end": "06:00" },
    { "type": "vehicle_group", "group_ids": ["..."] }
  ],
  "actions": [
    { "type": "alert", "severity": "critical" },
    { "type": "notify", "channels": ["email", "push"] },
    { "type": "webhook", "url": "https://erp.cliente.com/hook" }
  ],
  "cooldown_minutes": 30
}
```

### 7.3 Schema

```sql
CREATE TABLE automation_playbooks (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  name varchar(200) NOT NULL,
  is_active boolean DEFAULT true,
  trigger_config jsonb NOT NULL,
  conditions jsonb DEFAULT '[]',
  actions jsonb NOT NULL,
  cooldown_minutes int DEFAULT 15,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE automation_runs (
  id uuid PRIMARY KEY,
  playbook_id uuid NOT NULL,
  company_id uuid NOT NULL,
  vehicle_id uuid,
  trigger_payload jsonb,
  actions_executed jsonb,
  status varchar(20),
  created_at timestamptz DEFAULT now()
);
```

### 7.4 Ejecución

- Worker `automation-engine` suscrito a cola `automation-triggers`
- Productores: gps-worker, alert-worker, mobile events, cron, ai_insights
- **Migración gradual:** wrapper que convierte `alert_rules` → playbooks equivalentes

### 7.5 Ejemplos de negocio

| SI | ENTONCES |
|----|----------|
| Entra geocerca "Bodega" | Email supervisor + check-in automático |
| Batería móvil < 15% | Push admin + pausar rastreo |
| Exceso velocidad > 120 | Reporte diario acumulado |
| Vehículo activo fuera horario laboral | Alerta + webhook ERP |
| Insight IA `behavior_change` | Ticket revisión operador |

---

## Fase 8 — Multi-empresa y White Label

### 8.1 Estado actual

- Multi-tenant: `companies` + RLS ✓
- Roles: 6 niveles ✓
- Planes Stripe + `features` JSON ✓
- `white_label` flag en plan ✓

### 8.2 Extensiones white label

| Feature | Implementación |
|---------|----------------|
| Dominio custom | Vercel domains + middleware host routing |
| Logo/colores | `companies.settings.branding` |
| Email from | Resend subdomain por tenant |
| App mobile | EAS `extra.branding` por build profile |
| Legal propio | Templates `/legal` override |

### 8.3 Schema branding

```json
// companies.settings.branding
{
  "logo_url": "https://...",
  "primary_color": "#2563EB",
  "app_name": "Flota Cliente SA",
  "support_email": "soporte@cliente.com",
  "custom_domain": "gps.cliente.com"
}
```

### 8.4 Roles empresariales (sin cambio)

Mantener roles actuales; agregar permisos granulares v2:

- `permissions` JSON en `users` o tabla `role_permissions`
- UI admin para matrices permiso × módulo

---

## Fase 9 — API pública

### 9.1 Estado actual

- Tabla `api_keys` con `key_hash`, `permissions[]`, `expires_at`
- **Sin** endpoints REST documentados para terceros
- `features.api_access` en plan

### 9.2 API v1 propuesta

Base: `https://trackprogps.mx/api/v1/`

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/devices` | read |
| GET | `/devices/{id}` | read |
| GET | `/vehicles` | read |
| GET | `/vehicles/{id}/position` | read |
| GET | `/vehicles/{id}/history` | read:history |
| GET | `/alerts` | read:alerts |
| GET | `/events` | read:events |
| POST | `/webhooks/test` | admin |

**Auth:** Header `X-API-Key: tpro_live_...`  
**Rate limit:** 1000 req/h por key (Upstash Redis contador)

### 9.3 Gestión keys

- UI en `/settings/api-keys`
- Rotación: crear nueva → grace period → revocar antigua
- Audit: `last_used`, IP origen

### 9.4 OpenAPI / Swagger

- `apps/web/public/openapi/v1.yaml`
- Swagger UI en `/developers` (público, key en settings)

### 9.5 Compatibilidad

- APIs internas actuales (`/api/vehicles`, etc.) **sin cambio**
- v1 es fachada delgada con auth API key + rate limit

---

## Fase 10 — Escalabilidad empresarial

### 10.1 Targets

| Dispositivos | Posiciones/día | Arquitectura |
|--------------|----------------|--------------|
| 100k | ~50M | Postgres optimizado + read replica + batch |
| 500k | ~250M | Stream ingest + TSDB + Postgres metadata |
| 1M | ~500M | Multi-región + sharding + CDN |

### 10.2 Roadmap técnico por escala

#### 100k dispositivos

- [ ] Batch insert historial (COPY/RPC)
- [ ] Read replica Supabase
- [ ] Redis cluster (BullMQ)
- [ ] 3+ instancias gps-server + sticky TCP
- [ ] Reducir Realtime → polling híbrido mapa
- [ ] `fleet_daily_stats` materialized

#### 500k dispositivos

- [ ] Kafka/Redpanda ingest bus
- [ ] TimescaleDB o ClickHouse para history
- [ ] Separar servicio `telemetry-writer`
- [ ] Edge ingest regional (LATAM)
- [ ] CDN tiles mapa propio

#### 1M dispositivos

- [ ] Shard por `company_id` hash o región
- [ ] Global load balancing TCP Anycast
- [ ] Data lake S3 + Spark batch analytics
- [ ] TrackPro AI en pipeline async dedicado

### 10.3 Microservicios (cuándo dividir)

| Servicio | Separar cuando |
|----------|----------------|
| gps-tcp-server | >2k conexiones simultáneas/instance |
| telemetry-writer | Postgres CPU >70% sustained |
| alert-engine | Queue lag >30s P95 |
| ai-worker | Costos/latencia API web |
| report-generator | PDF jobs >100/h |

**Hoy:** monolito modular dentro del monorepo es correcto.

### 10.4 Cache

| Dato | Cache | TTL |
|------|-------|-----|
| Device lookup IMEI | Redis | 5 min (existente in-memory → Redis) |
| Alert rules | Redis | 3 min |
| KPI dashboard | Redis | 15 min |
| Map tiles | CDN | 24h |

---

*Continúa en [`ENTERPRISE_SEGURIDAD_UX.md`](./ENTERPRISE_SEGURIDAD_UX.md)*
