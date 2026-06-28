# White Label — TrackProGPS

**Versión:** 1.0 · Junio 2026  
**Estado:** Feature flag en plan Empresarial; implementación UI pendiente

---

## 1. Qué es White Label en TrackProGPS

Permite que **distribuidores e integradores** ofrezcan la plataforma bajo **su propia marca**, sin fork de código:

- Logo y colores del partner
- Dominio propio (ej. `gps.flota-xyz.com`)
- Nombre comercial en emails y app
- Misma infraestructura TrackProGPS (multi-tenant)

**Principio:** un codebase, múltiples marcas — configuración por tenant/partner en `settings.branding`.

---

## 2. Estado actual

| Capacidad | Estado |
|-----------|--------|
| `plans.features.white_label` | ✅ Flag en Empresarial |
| `companies.logo_url` | ✅ Campo DB, sidebar puede mostrar |
| `settings.branding` | ⚠ Spec en docs, no UI completa |
| Dominio custom | ❌ |
| Emails branded | ❌ (Resend from fijo) |
| Mobile app branded | ❌ (EAS single brand) |
| Partner portal | ❌ |

---

## 3. Modelo de datos branding

### 3.1 Schema propuesto (`companies.settings.branding`)

```json
{
  "branding": {
    "enabled": true,
    "commercial_name": "FlotaTrack Pro",
    "logo_url": "https://cdn.partner.com/logo.svg",
    "logo_dark_url": "https://cdn.partner.com/logo-white.svg",
    "favicon_url": "https://cdn.partner.com/favicon.ico",
    "primary_color": "#1E3A5F",
    "accent_color": "#2563EB",
    "custom_domain": "gps.flota-xyz.com",
    "email_from_name": "FlotaTrack Soporte",
    "email_reply_to": "soporte@flota-xyz.com",
    "hide_trackpro_branding": true,
    "login_background_url": "https://cdn.partner.com/bg.jpg",
    "mobile_app_name": "FlotaTrack"
  }
}
```

### 3.2 Partner-level branding (target)

```json
// partners.settings.branding — hereda a child tenants si no override
{
  "partner_id": "uuid",
  "default_branding": { ... },
  "allow_tenant_override": false
}
```

**Herencia:** tenant hijo usa branding partner salvo `companies.settings.branding.override = true`.

---

## 4. Resolución de tenant por dominio

### 4.1 Flujo request

```
Request Host: gps.flota-xyz.com
  → middleware.ts detecta custom domain
  → lookup companies WHERE settings->branding->>custom_domain = host
  → inject tenant context (cookie/header x-tenant-id)
  → cargar CSS variables desde branding
```

### 4.2 Implementación Vercel

1. Partner configura CNAME → `cname.vercel-dns.com`
2. Vercel project domains: add `gps.flota-xyz.com`
3. Middleware resuelve company_id
4. SSL automático Let's Encrypt

**Alternativa enterprise:** Cloudflare for SaaS (custom hostnames ilimitados).

### 4.3 Dominio default

| Host | Branding |
|------|----------|
| trackprogps.mx | TrackProGPS default |
| app.trackprogps.mx | TrackProGPS default |
| gps.partner.com | Partner branding |

---

## 5. Personalización visual

### 5.1 Web (Next.js)

| Elemento | Implementación |
|----------|----------------|
| Logo sidebar | `companies.logo_url` o `branding.logo_url` |
| Colores | CSS variables `--brand-primary`, `--brand-accent` |
| Login | Logo + background custom |
| Emails | Templates con variables branding |
| Favicon | `app/icon` dynamic o link tag |
| PWA manifest | `name`, `icons` por tenant (target) |

**Archivos a extender:**
- `apps/web/src/app/layout.tsx` — inject CSS vars
- `apps/web/src/components/layout/sidebar.tsx` — logo
- `apps/web/src/app/(auth)/login/page.tsx` — branded login
- `apps/web/src/middleware.ts` — domain resolution

### 5.2 Mobile (Expo)

| Nivel | Enfoque |
|-------|---------|
| **Fase 1** | Nombre app + splash en build profile EAS por partner |
| **Fase 2** | Runtime theming (limitado RN) |
| **Fase 3** | App Store listing separado por partner |

**EAS config ejemplo:**

```json
{
  "build": {
    "partner-flotatrack": {
      "env": { "EXPO_PUBLIC_BRAND_NAME": "FlotaTrack" },
      "android": { "package": "com.partner.flotatrack" },
      "ios": { "bundleIdentifier": "com.partner.flotatrack" }
    }
  }
}
```

---

## 6. Emails personalizados

| Email | Branding |
|-------|----------|
| Bienvenida | Logo partner, from name |
| Invitación usuario | Link a dominio partner |
| Alerta GPS | Footer partner |
| Pago / factura | Razón social partner o TrackPro |
| Reset password | Supabase template custom por tenant* |

*Supabase Auth templates: limitado; alternativa: custom SMTP Resend por partner.

### 6.1 Resend multi-from

```
From: {branding.email_from_name} <noreply@{custom_domain}>
Reply-To: {branding.email_reply_to}
```

Requiere verificar dominio en Resend por partner (Gold+ tier).

---

## 7. White label y planes

| Plan | White label |
|------|-------------|
| Básico | ❌ |
| Profesional | ❌ |
| Empresarial | ✅ Flag |
| Enterprise | ✅ + dominio + mobile |
| Partner Gold+ | ✅ Incluido en acuerdo |

**Gate:** middleware + settings API verifican `features.white_label` antes de permitir edit branding.

---

## 8. Portal distribuidor + white label

```
Partner login → /partner/dashboard
  ├── Branding editor (preview live)
  ├── Dominio: instrucciones DNS + verify
  ├── Clientes: lista tenants hijos
  └── Facturación: comisiones

Cliente final login → gps.partner.com
  └── Ve solo branding partner (hide_trackpro_branding: true)
```

---

## 9. Legal y compliance

| Aspecto | Requisito |
|---------|-----------|
| Aviso privacidad | Partner puede hostear propio o co-brand |
| Términos | TrackPro master + addendum partner |
| LFPDPPP | Responsable: partner o TrackPro según contrato |
| Marca TrackPro | "Powered by TrackProGPS" opcional si `hide_trackpro_branding: false` |

---

## 10. Seguridad white label

| Riesgo | Mitigación |
|--------|------------|
| Domain hijack | Verify DNS TXT before activate |
| XSS en logo URL | Allowlist CDN domains |
| Cross-tenant via domain | Unique constraint on custom_domain |
| Phishing | Partner KYC antes de white label |

---

## 11. Roadmap implementación

| Fase | Entregable | Esfuerzo |
|------|------------|----------|
| WL-1 | UI settings branding (logo, colores) | 1 sem |
| WL-2 | CSS variables en layout + login | 3 días |
| WL-3 | Gate feature white_label | 2 días |
| WL-4 | Middleware custom domain | 1 sem |
| WL-5 | Emails branded (Resend) | 1 sem |
| WL-6 | Partner portal + herencia | 3 sem |
| WL-7 | EAS build profile partner | 2 sem |
| WL-8 | PWA manifest dynamic | 3 días |

---

## 12. Ejemplo experiencia usuario

**Distribuidor:** "Transportes del Norte" vende "TDN GPS"

1. Cliente visita `gps.tdn.mx`
2. Login muestra logo TDN, colores azul/rojo TDN
3. Dashboard sin mención TrackProGPS
4. Emails desde `alertas@tdn.mx`
5. App móvil "TDN GPS" en stores (build partner)
6. TrackPro factura a TDN; TDN factura al cliente

---

## 13. Referencias

- [`MODELO_COMERCIAL_TRACKPROGPS.md`](./MODELO_COMERCIAL_TRACKPROGPS.md) — tiers partner
- [`ARQUITECTURA_SAAS_TRACKPROGPS.md`](./ARQUITECTURA_SAAS_TRACKPROGPS.md) — partners schema
- [`ENTERPRISE_AUTOMATIZACION_ESCALA.md`](./ENTERPRISE_AUTOMATIZACION_ESCALA.md) — spec previa branding
- [`SISTEMA_PLANES_TRACKPROGPS.md`](./SISTEMA_PLANES_TRACKPROGPS.md) — flag white_label

---

*Prompt 6 — Fase 7 documentada. UI branding = primer paso implementable.*
