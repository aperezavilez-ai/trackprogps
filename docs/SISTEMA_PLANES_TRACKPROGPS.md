# Sistema de planes — TrackProGPS

**Versión:** 1.0 · Junio 2026  
**Estado:** Catálogo en DB + Stripe; enforcement parcial

---

## 1. Visión

Los planes controlan **qué puede hacer cada empresa** y **cuánto puede consumir**. Deben ser **configurables desde administración** sin redeploy, con enforcement consistente en API y UI.

---

## 2. Schema actual

### 2.1 Tabla `plans`

```sql
CREATE TABLE plans (
  id            uuid PRIMARY KEY,
  name          varchar(100),      -- "Básico", "Profesional", "Empresarial"
  type          plan_type,         -- basico | profesional | empresarial
  max_vehicles  int,
  max_users     int,
  price_monthly numeric(10,2),     -- MXN
  price_yearly  numeric(10,2),
  features      jsonb,             -- feature flags
  is_active     boolean
);
```

### 2.2 Tabla `subscriptions`

```sql
CREATE TABLE subscriptions (
  company_id            uuid UNIQUE,
  plan_id               uuid REFERENCES plans,
  status                subscription_status,  -- active | past_due | cancelled | trialing
  stripe_customer_id    text,
  stripe_subscription_id text,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  ...
);
```

**Relación:** una suscripción por empresa. Plan efectivo = `subscriptions.plan_id` (post-pago) o `companies.plan_id` (fallback/demo).

---

## 3. Catálogo default

| Feature | Básico | Profesional | Empresarial | Enterprise* |
|---------|:------:|:-----------:|:-----------:|:-----------:|
| **Precio/mes MXN** | 299 | 799 | 2,499 | Custom |
| **Vehículos max** | 10 | 50 | 999 | ∞ |
| **Usuarios max** | 3 | 10 | 999 | ∞ |
| **Dispositivos mobile max** | 0† | 10 | 999 | ∞ |
| Mapa tiempo real | ✅ | ✅ | ✅ | ✅ |
| Historial (días) | 30 | 90 | 365 | Custom |
| Alertas | ✅ | ✅ | ✅ | ✅ |
| Geocercas | ✅ | ✅ | ✅ | ✅ |
| Reportes | ❌ | ✅ | ✅ | ✅ |
| Mantenimiento | ❌ | ✅ | ✅ | ✅ |
| Mobile Tracker | ❌ | ✅ | ✅ | ✅ |
| IA asistente | ❌ | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ | ✅ |
| White label | ❌ | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ❌ | ✅ | ✅ |
| Soporte | Email | Email | Prioritario | Dedicado |
| SLA uptime | — | — | 99.5% | 99.9% |

*Enterprise = plan custom en DB, no seed default.  
†Mobile limit propuesto — hoy no enforced.

### 3.1 JSON `features` (TypeScript)

```typescript
interface PlanFeatures {
  realtime_map: boolean
  route_history_days: number
  alerts: boolean
  geofences: boolean
  reports: boolean
  maintenance: boolean
  mobile_app: boolean
  ai_assistant: boolean
  api_access: boolean
  white_label: boolean
}
```

**Extensiones propuestas:**

```typescript
interface PlanFeaturesExtended extends PlanFeatures {
  max_mobile_devices?: number
  max_api_requests_month?: number
  max_storage_gb?: number
  max_reports_month?: number
  webhooks?: boolean
  automation_playbooks?: boolean
  video_telematics?: boolean
  sso?: boolean
}
```

---

## 4. Plan ENTERPRISE (custom)

Plan negociado fuera del catálogo self-service:

| Aspecto | Configuración |
|---------|---------------|
| Creación | super_admin insert en `plans` con `is_active=true`, type custom |
| Precio | Contrato; Stripe Price manual o invoice |
| Límites | `max_vehicles`, `max_users` elevados o NULL = unlimited |
| Features | Todas true + flags enterprise |
| Soporte | SLA documentado en contrato |
| White label | Obligatorio |
| API | Rate limit negociado |

**No requiere código nuevo** — insert admin + assign vía `/api/admin/companies/[id]`.

---

## 5. Control de límites

### 5.1 RPC `get_company_usage`

Retorna JSON:

```json
{
  "vehicles": { "current": 8, "max": 10 },
  "users": { "current": 2, "max": 3 },
  "features": { ... },
  "at_vehicle_limit": false,
  "at_user_limit": false
}
```

**Consumidores:** `useCompanyUsage`, `PlanLimitBanner`.

### 5.2 Matriz de enforcement

| Límite / Feature | API enforcement | UI gate | Alerta |
|------------------|-----------------|---------|--------|
| max_vehicles | ✅ POST /api/vehicles → 402 | PlanLimitBanner ≥80% | Banner |
| max_users | ❌ | — | Target |
| mobile_app | ❌ | Nav visible | Target |
| max_mobile_devices | ❌ | — | Target |
| route_history_days | ❌ (fixed 7d API) | — | Target |
| reports | ❌ | Nav visible | Target |
| maintenance | ❌ | Nav visible | Target |
| ai_assistant | ✅ POST /api/ai/chat | Sidebar hide | 403 |
| api_access | ❌ | — | Target |
| white_label | ❌ | — | Target |
| max_api_requests | ❌ | — | Target |

### 5.3 Comportamiento al alcanzar límite

| Recurso | Comportamiento |
|---------|----------------|
| Vehículos | HTTP 402 + mensaje upgrade; banner rojo |
| Usuarios (target) | HTTP 402 en invite |
| API (target) | HTTP 429 + headers rate limit |
| Storage (target) | Warning → block uploads |

### 5.4 Alertas de consumo

| Umbral | Acción |
|--------|--------|
| 80% | Banner amarillo (vehículos — ✅) |
| 95% | Email admin_empresa |
| 100% | Block + banner rojo + email |

**Extender `PlanLimitBanner`** a usuarios, mobile, API.

---

## 6. Configuración desde administración

### 6.1 Hoy

| Acción | Método |
|--------|--------|
| Cambiar plan tenant | super_admin API `change_plan` |
| Ver planes públicos | GET `/api/plans/public` |
| Editar planes DB | SQL directo / Supabase dashboard |

### 6.2 Target — Admin UI planes

```
/admin/plans
  ├── Lista planes (CRUD)
  ├── Editor features (checkboxes + números)
  ├── Preview comparativa (landing pricing)
  ├── Sync Stripe Products (opcional)
  └── Historial cambios plan
```

**Migración:** `plans` ya soporta CRUD; falta UI y validación de features en middleware central.

---

## 7. Integración billing

### 7.1 Flujo plan → pago

```
Usuario elige plan (register o billing)
  → resolve-plan.ts (UUID o slug basico/pro/empresa)
  → Stripe Checkout (price dynamic MXN)
  → Webhook actualiza subscriptions + companies.plan_id + status active
```

### 7.2 Cambio de plan

| Dirección | Comportamiento |
|-----------|----------------|
| Upgrade | Inmediato; proration Stripe |
| Downgrade | Fin de periodo; validar límites actuales vs nuevo max |
| Cancel | status cancelled; DemoGate/suspended |

**Validación downgrade:** si `vehicles.current > new.max_vehicles` → bloquear o grace period 30d.

### 7.3 Periodo de prueba

| Modelo | Implementación |
|--------|----------------|
| Demo actual | `status: demo`, sin trial_ends_at |
| Trial 14d (target) | `trial_ends_at`, `TrialGate` mount, cron expire |
| Trial sin tarjeta | status trialing, features Profesional |

**Fix pendiente:** UI register dice "14 días" pero backend usa demo; alinear.

---

## 8. Planes por segmento account_type

| account_type | Plan recomendado | Notas |
|--------------|------------------|-------|
| personal | Básico | 1–3 vehículos |
| family | Básico / Profesional | miembro_familiar role |
| business | Profesional+ | vehicle_groups, onboarding API |

No hay planes separados en DB — recomendación comercial en UI registro.

---

## 8. API pública y planes

| Plan | Rate limit (spec) |
|------|-------------------|
| Profesional | 500 req/h |
| Empresarial | 5,000 req/h |
| Enterprise | Negociado |

Ver [`API_COMERCIAL_TRACKPROGPS.md`](./API_COMERCIAL_TRACKPROGPS.md).

---

## 9. Almacenamiento histórico por plan

| Plan | route_history_days (feature) | Cleanup cron (actual) |
|------|------------------------------|------------------------|
| Básico | 30 | 365 días global ❌ mismatch |
| Profesional | 90 | 365 días global |
| Empresarial | 365 | 365 días global |

**Target:** cron `cleanup-old-positions` use `plans.features.route_history_days` por company.

---

## 10. Roadmap implementación planes

| # | Tarea | Prioridad |
|---|-------|-----------|
| 1 | Enforce max_users en invite | P0 |
| 2 | Gate nav/API por features (reports, maintenance, mobile) | P0 |
| 3 | route_history_days en API history | P1 |
| 4 | max_mobile_devices en register mobile | P1 |
| 5 | Admin UI CRUD plans | P1 |
| 6 | PlanLimitBanner multi-recurso | P1 |
| 7 | Trial 14d alineado | P2 |
| 8 | Overage billing Stripe | P2 |
| 9 | Plan Enterprise template | P2 |

---

## 11. Ejemplo: crear plan partner

```sql
INSERT INTO plans (name, type, max_vehicles, max_users, price_monthly, price_yearly, features)
VALUES (
  'Partner Gold',
  'empresarial',
  500, 50,
  1499, 14990,
  '{"realtime_map":true,"route_history_days":365,"alerts":true,"geofences":true,
    "reports":true,"maintenance":true,"mobile_app":true,"ai_assistant":true,
    "api_access":true,"white_label":true}'::jsonb
);
```

Asignar a tenants partner vía admin API.

---

## 12. Referencias

- `supabase/migrations/002_core_tables.sql`
- `packages/types/src/index.ts` — `PlanFeatures`
- `apps/web/src/lib/billing/resolve-plan.ts`
- [`MODELO_COMERCIAL_TRACKPROGPS.md`](./MODELO_COMERCIAL_TRACKPROGPS.md)
- [`MANUAL_ADMINISTRADOR_SAAS.md`](./MANUAL_ADMINISTRADOR_SAAS.md)

---

*Prompt 6 — Fase 4–5 documentadas. Enforcement completo pendiente implementación.*
