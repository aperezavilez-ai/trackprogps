# Modelo comercial — TrackProGPS

**Versión:** 1.0 · Junio 2026  
**Mercado primario:** México (MXN, CFDI, flotas SMB–enterprise)

---

## 1. Propuesta de valor

TrackProGPS es una **plataforma SaaS de telemática** que unifica en un solo producto:

- Rastreo GPS hardware (Teltonika y catálogo multi-marca)
- Rastreo móvil (TrackProGPS Mobile)
- Mapas en tiempo real, geocercas, alertas
- Reportes, mantenimiento, IA asistente
- Billing self-service y administración multiempresa

**Diferenciadores enterprise:** white label para distribuidores, API para integraciones ERP/logística, escalabilidad documentada.

---

## 2. Segmentos de cliente

| Segmento | Perfil | Plan típico | Canal |
|----------|--------|-------------|-------|
| **Personal / Familia** | 1–5 vehículos | Básico | Web directo |
| **PyME flotilla** | 5–50 vehículos | Profesional | Web + partners |
| **Empresa mediana** | 50–500 vehículos | Empresarial | Ventas + partner |
| **Enterprise / Gobierno** | 500+ vehículos | Enterprise custom | Contrato directo |
| **Distribuidor / Integrador** | Revende plataforma | Partner + white label | Canal B2B2B |

---

## 3. Modelos de ingreso

### 3.1 Implementados hoy

| Modelo | Mecanismo | Estado |
|--------|-----------|--------|
| Suscripción mensual | Stripe Checkout MXN | ✅ |
| Suscripción anual | Stripe (precio anual en `plans`) | ✅ |
| Demo / exploración | `status: demo`, sin cobro | ✅ |
| Override admin | super_admin change_plan | ✅ |

### 3.2 Target enterprise

| Modelo | Descripción |
|--------|-------------|
| **Freemium limitado** | 1 vehículo, historial 7 días |
| **Trial 14 días** | Profesional completo, tarjeta opcional |
| **Per-seat** | Cobro por usuario adicional |
| **Overage** | Vehículos extra sobre límite plan |
| **Revenue share partner** | % comisión distribuidor |
| **Setup fee** | Instalación GPS + capacitación |
| **API usage** | Tier por requests/mes |

---

## 4. Catálogo de planes (resumen)

Ver detalle en [`SISTEMA_PLANES_TRACKPROGPS.md`](./SISTEMA_PLANES_TRACKPROGPS.md).

| Plan | Precio/mes MXN | Vehículos | Usuarios | Público |
|------|----------------|-----------|----------|---------|
| Básico | $299 | 10 | 3 | Personal, micro-flota |
| Profesional | $799 | 50 | 10 | PyME |
| Empresarial | $2,499 | 999 | 999 | Mediana-grande |
| Enterprise | Custom | Negociado | Negociado | Contrato |

Precios anuales: ~10 meses (descuento ~17%).

---

## 5. Journey del cliente

### 5.1 Adquisición directa

```
Landing trackprogps.mx
  → /register (elige plan)
  → Confirmación email
  → Demo dashboard (DemoGate)
  → /billing checkout Stripe
  → Cuenta active
  → Onboarding: vehículos, dispositivos, usuarios
```

### 5.2 Adquisición vía distribuidor (target)

```
Partner white label portal
  → Crea tenant + admin cliente
  → Cliente recibe email marca partner
  → Login en gps.partner.com
  → Partner factura o TrackPro rev-share
```

### 5.3 Retención

| Touchpoint | Automatización |
|------------|----------------|
| Día 0 | Email bienvenida |
| Día 7 demo | Recordatorio activar plan |
| 80% límite vehículos | PlanLimitBanner + email |
| Renovación -7d | Aviso renovación |
| Pago fallido | Email + grace 3 días |
| Cancelación | Encuesta + win-back 30d |

---

## 6. Gestión de clientes (módulo admin)

### 6.1 Implementado hoy

| Función | Ubicación | Rol |
|---------|-----------|-----|
| Lista empresas | `/admin` | super_admin |
| KPIs plataforma | `/admin` (MRR, activos) | super_admin |
| Suspender / activar | API `/api/admin/companies/[id]` | super_admin |
| Cambiar plan | API admin | super_admin |
| Usuarios plataforma | `/admin/users` variant=platform | super_admin |
| Usuarios tenant | `/admin/users` variant=company | admin_empresa |
| Soporte | `/admin/support` | platform team |
| Onboarding flota | `/api/clients/onboard` | admin_empresa |

### 6.2 Target — CRM integrado

| Entidad | Campos clave | UI |
|---------|--------------|-----|
| **Cliente/Empresa** | name, RFC, status, plan, partner | Admin company detail |
| **Contacto** | Nombre, email, teléfono, rol | Tab contactos |
| **Sucursal** | Dirección, responsable | Tab sucursales (→ branches) |
| **Dispositivos** | IMEI, vehículo, estado | Link /devices |
| **Historial** | audit_logs, pagos, tickets | Timeline |
| **Estado cuenta** | demo/trial/active/suspended | Badge + acciones |

**Reutilizar:** no duplicar — extender `/admin` con ficha empresa completa consumiendo API existente.

---

## 7. Facturación y pagos

### 7.1 Stripe (producción actual)

| Capacidad | Estado |
|-----------|--------|
| Checkout suscripción | ✅ |
| Customer Portal (cambio plan, tarjeta) | ✅ |
| Webhooks lifecycle | ✅ |
| MRR platform stats | ✅ |
| Facturas CFDI | ❌ Placeholder UI |
| Mercado Pago | ❌ |

Flujo documentado en código: `billing/checkout`, `webhooks/stripe`, `billing-client.tsx`.

### 7.2 Arquitectura multi-proveedor (target)

```
┌─────────────────┐
│ BillingService  │  (abstracción)
├────────┬────────┤
│ Stripe │ MercadoPago │ (futuro: Conekta)
└────────┴────────┘
         │
    subscriptions (provider, external_id)
    invoices (provider, pdf_url, cfdi_uuid)
```

**Campos existentes reutilizables:**
- `subscriptions.stripe_customer_id`
- `subscriptions.stripe_subscription_id`
- `subscriptions.conekta_order_id` (legacy, repurpose o deprecate)

### 7.3 CFDI México

Settings en `companies.settings.billing_cfdi`:
- Razón social, RFC, régimen fiscal, uso CFDI
- PAC provider + API key

**Pendiente:** tabla `invoices`, timbrado automático post-pago Stripe, entrega XML/PDF.

---

## 8. Portal de cliente (empresa)

El **dashboard actual ES el portal de cliente**. Capacidades:

| Sección | Ruta | Estado |
|---------|------|--------|
| Mapa en vivo | `/map` | ✅ |
| Vehículos | `/vehicles` | ✅ |
| Dispositivos | `/devices` | ✅ |
| Mobile | `/mobile` | ✅ |
| Alertas | `/alerts` | ✅ |
| Reportes | `/reports` | ✅ |
| Geocercas | `/geofences` | ✅ |
| Usuarios | Settings invite | ✅ |
| Billing | `/billing` | ✅ |
| Consumo plan | PlanLimitBanner | ⚠ Solo vehículos |
| Soporte | Contacto / tickets | ⚠ Parcial |

**Mejoras portal:** widget consumo unificado (vehículos, usuarios, API, storage), centro de ayuda, estado suscripción prominente.

---

## 9. Portal de distribuidores (target)

### 9.1 Funcionalidades

| Función | Descripción |
|---------|-------------|
| Dashboard comercial | Clientes activos, MRR atribuido, comisiones |
| Crear cliente | Provisioning tenant + admin |
| Gestionar planes | Asignar plan partner (precio mayorista) |
| Branding | Logo, colores, dominio white label |
| Reportes | Crecimiento, churn partner |
| Soporte L1 | Ver tickets clientes hijos (delegado) |

### 9.2 Modelo comercial partner

| Tier partner | Clientes min | Descuento | White label |
|--------------|--------------|-----------|-------------|
| Silver | 5 | 15% | Logo only |
| Gold | 25 | 25% | Dominio custom |
| Platinum | 100 | 35% | App mobile branded |

---

## 10. Sistema de licencias (target)

```
licenses (
  id, company_id, partner_id,
  plan_id, status,          -- active | expired | suspended
  activated_at, expires_at,
  license_key,              -- opcional offline activation
  metadata jsonb
)
```

**Eventos:**
- Activación: post-pago o provisioning partner
- Renovación: webhook Stripe `subscription.updated`
- Expiración: cron daily → suspend company
- Suspensión manual: admin / partner
- Reactivación: pago o admin override

**Reutilizar:** `companies.status` + `subscriptions.status` como fuente de verdad inicial; `licenses` como capa explícita enterprise.

---

## 11. Analítica comercial (target)

### 11.1 Métricas plataforma (parcial en `/admin`)

| Métrica | Fuente | Estado |
|---------|--------|--------|
| Empresas activas | `companies.status` | ✅ |
| MRR | `plans.price × subscriptions active` | ✅ API platform-stats |
| Vehículos conectados | `gps_devices.status=online` | Calculable |
| Usuarios activos | `users.last_sign_in_at` | Calculable |
| Churn | cancelled / month | ❌ |
| Trial conversion | demo → active | ❌ |
| Uso por feature | audit + API logs | ❌ |

### 11.2 Dashboard target

```
┌─────────────────────────────────────────┐
│ TrackPro Business Intelligence           │
├──────────────┬──────────────┬───────────┤
│ MRR: $XXX    │ ARR: $X,XXX  │ +12% MoM  │
│ Clientes: N  │ Vehículos: N │ Online: N │
├──────────────┴──────────────┴───────────┤
│ [Gráfico MRR 12 meses]                  │
│ [Churn cohort] [Plan mix pie]           │
│ [Top partners] [Trial funnel]           │
└─────────────────────────────────────────┘
```

---

## 12. Automatización comercial

### 12.1 Implementado

| Email | Trigger |
|-------|---------|
| Invitación usuario | Edge function send-invitation |
| Pago fallido | send-payment-failed-email |
| Alertas GPS | send-alert-notification |

### 12.2 Target

| Email | Trigger | Herramienta |
|-------|---------|-------------|
| Bienvenida | Registro | Resend template |
| Trial día 3, 7, 13 | Cron | pg_cron + edge |
| Renovación -7d | Stripe upcoming invoice | Webhook |
| Límite 80% | usage check | Daily cron |
| Cancelación win-back | subscription.deleted | Webhook + delay |

---

## 13. Go-to-market internacional

| Región | Moneda | Pago | Legal |
|--------|--------|------|-------|
| México | MXN | Stripe + MP (target) | LFPDPPP, CFDI |
| LATAM | USD/local | Stripe | GDPR-like local |
| USA | USD | Stripe | SOC2 path |

**Arquitectura:** mismo codebase; `plans.currency`, `companies.country`, provider billing por región.

---

## 14. KPIs comerciales objetivo

| KPI | Año 1 | Año 2 |
|-----|-------|-------|
| Clientes pagando | 200 | 1,000 |
| MRR | $150k MXN | $800k MXN |
| Churn mensual | <5% | <3% |
| Trial → paid | >25% | >35% |
| Partners activos | 5 | 30 |
| NPS | >40 | >50 |

---

## 15. Referencias

- [`SISTEMA_PLANES_TRACKPROGPS.md`](./SISTEMA_PLANES_TRACKPROGPS.md)
- [`ARQUITECTURA_SAAS_TRACKPROGPS.md`](./ARQUITECTURA_SAAS_TRACKPROGPS.md)
- [`WHITE_LABEL_TRACKPROGPS.md`](./WHITE_LABEL_TRACKPROGPS.md)
- [`ENTERPRISE_ROADMAP_FUTURO.md`](./ENTERPRISE_ROADMAP_FUTURO.md)

---

*Prompt 6 — Modelo comercial documentado. Implementación por fases sobre billing existente.*
