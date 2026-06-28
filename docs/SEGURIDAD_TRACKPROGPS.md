# Seguridad TrackProGPS — Auditoría y hardening enterprise

**Versión:** 1.0 · **Fecha:** Junio 2026  
**Alcance:** Plataforma completa post-GPS + Mobile + Enterprise docs  
**Modo:** Auditoría documental — **sin cambios de código en esta fase**

---

## 1. Resumen ejecutivo (CISO)

TrackProGPS opera como SaaS multi-tenant con **base de seguridad aceptable para MVP/SMB**, pero **no cumple aún** requisitos enterprise estrictos (2FA, auditoría completa, rate limiting global, hardening GPS).

| Área | Nivel actual | Target enterprise |
|------|--------------|-------------------|
| Autenticación | Medio | Alto (+ 2FA, sesiones) |
| Autorización (RBAC/RLS) | Medio-Alto | Alto |
| APIs | Medio | Alto (+ rate limit, audit) |
| GPS / IoT | Medio-Bajo | Medio-Alto |
| Mobile | Medio | Alto |
| Infraestructura | Medio-Alto | Alto |
| Datos / cifrado | Medio | Alto |
| Monitoreo / IR | Bajo | Alto |

**Hallazgos críticos/altos:** 0 críticos confirmados en explotación activa; **8 altos** requieren plan de remediación priorizado.

**Compatibilidad:** Todas las recomendaciones preservan Teltonika, mobile, APIs existentes y multi-tenant.

---

## 2. Estado actual por capa

### 2.1 Arquitectura

```
Internet
  ├── Vercel (HTTPS) → Next.js + API Routes
  ├── Fly.io TCP :5000 → gps-server (Teltonika)
  ├── Supabase (Auth + Postgres + Realtime)
  ├── Upstash Redis (BullMQ)
  └── Servicios: Stripe, Resend, Anthropic, Google Maps, Expo Push
```

**Fortalezas:** separación ingesta/UI, RLS multi-tenant, webhooks firmados, PWA con cookies Supabase SSR.

**Debilidades:** monolito API sin WAF dedicado, GPS sin TLS nativo, dependencia concentrada en Supabase/Vercel.

---

### 2.2 Backend / APIs (~55 rutas)

| Control | Estado |
|---------|--------|
| Auth cookie (web) | ✓ Supabase SSR |
| Auth Bearer (mobile) | ✓ `getApiUser()` |
| Validación Zod | ✓ Mayoría rutas |
| RBAC por ruta | ⚠ Parcial (checks manuales) |
| Rate limiting global | ✗ |
| API pública v1 | ✗ (spec only) |
| Service role usage | ⚠ 20+ rutas — revisar cada una |
| Audit log API calls | ✗ |

**Endpoints públicos sin auth:**
- `POST /api/auth/register` — **service role**, sin rate limit
- `POST /api/support/contact` — honeypot + 5 min/email ✓
- `GET /api/share/location/[token]` — token opaco SHA256 ✓
- `POST /api/webhooks/stripe` — firma verificada ✓
- `GET /api/plans/public` — datos públicos ✓

**Service role (privilegio elevado):** register, invite, mobile ingest, support, admin ops. Cada uno debe mantener validación estricta de caller — hoy **register es el más expuesto**.

---

### 2.3 Frontend

| Control | Estado |
|---------|--------|
| Login Supabase | ✓ |
| Email confirmation | ✓ |
| Dashboard layout auth | ✓ redirect si no user |
| `canAccessRoute()` | ✗ **no en middleware** |
| XSS React default | ✓ escaping |
| CSP headers | ✗ no configurado |
| HSTS | ✓ Vercel default |
| `poweredByHeader` | ✓ false |

**Riesgo:** usuario con rol limitado puede acceder URLs directas si API no valida (defensa en profundidad incompleta).

---

### 2.4 Base de datos (Supabase Postgres)

| Control | Estado |
|---------|--------|
| RLS habilitado | ✓ tablas tenant |
| `get_company_id()` | ✓ |
| Group access familiar | ✓ migración 013 |
| `audit_logs` | ✓ schema, uso parcial |
| `api_keys.key_hash` | ✓ SHA256 |
| Backups PITR | ✓ Supabase managed |
| Encryption at rest | ✓ Supabase |
| Connection pooling | ✓ Supavisor |

**Gaps RLS:**
- `mobile_events_insert_service` — policy `WITH CHECK (true)` (solo relevante si rol anon inserta; service role bypass RLS anyway)
- Geocercas / `alert_rules` vs `miembro_familiar` — inconsistencias documentadas
- Views/materialized sin RLS si se añaden

**Inyección SQL:** PostgREST parametriza queries; riesgo en `.or()` con strings interpolados:

```typescript
// apps/web/src/app/api/vehicles/route.ts
.or(`economic_num.ilike.%${search}%,...`)  // filtrar % _ en search
```

Mismo patrón en `/api/drivers`, `/api/ai/chat`.

---

### 2.5 Aplicación móvil (Expo)

| Control | Estado |
|---------|--------|
| Auth Supabase + AsyncStorage | ✓ |
| Bearer JWT a API | ✓ |
| Sesiones revocables | ✓ `mobile_sessions` |
| Background location consent | ✓ permisos OS |
| Mock location detect | ✓ alerta, no bloqueo |
| Root/jailbreak detect | ✗ |
| Certificate pinning | ✗ |
| Ofuscación binario | ✗ (EAS default) |
| Secure storage tokens | ⚠ AsyncStorage (no Keychain wrapper) |

---

### 2.6 GPS / Teltonika (Fly.io)

| Control | Estado |
|---------|--------|
| Protocolo | TCP binario Codec 8/8E |
| Autenticación dispositivo | **Solo IMEI** (conoce quien conecta) |
| TLS | ✗ (protocolo Teltonika estándar sin TLS) |
| IMEI spoofing | ⚠ posible si IMEI registrado |
| Buffer overflow protection | ✓ límite 64KB |
| DDoS / flood TCP | ⚠ sin rate limit IP |
| Logs | IMEI + IP en plaintext |

**Nota:** TLS en Teltonika requiere firmware/config específica; mitigación = whitelist IMEI + red privada/VPN opcional enterprise.

---

### 2.7 Infraestructura

| Componente | Seguridad |
|------------|-----------|
| Vercel | HTTPS, DDoS básico, env secrets |
| Fly.io GPS | TCP público :5000, HTTP health :3001 |
| Supabase | SOC2 Type II (vendor), RLS |
| Redis Upstash | TLS, auth token |
| DNS trackprogps.mx | SSL via Vercel |

**Secrets:** `.env` en `.gitignore` ✓. Fly/Vercel secrets para prod ✓. **Riesgo:** `next.config.js` carga `.env` raíz en build.

---

### 2.8 Servicios externos

| Servicio | Datos expuestos | Mitigación |
|----------|-----------------|------------|
| Anthropic | Flota vía tools | Plan gate, ampliar rate limit |
| Stripe | Billing | Webhook signature ✓ |
| Resend | Emails | API key server-only |
| Google Maps | Coordenadas client-side | Key restriction por dominio |
| Expo Push | Tokens | — |

---

## 3. Vulnerabilidades encontradas

### 3.1 Alta severidad

| ID | Vulnerabilidad | CVSS orient. | Evidencia | Remediación |
|----|----------------|--------------|-----------|-------------|
| SEC-A01 | Registro público sin rate limit + service role | 7.5 | `api/auth/register` | Rate limit IP, CAPTCHA, queue |
| SEC-A02 | RBAC no enforced en middleware | 7.0 | `middleware.ts` solo refresh | Middleware routes + API guard |
| SEC-A03 | IMEI spoofing GPS | 7.0 | TCP handshake IMEI only | Pre-registro IMEI, alerta desconocido |
| SEC-A04 | Sin rate limit APIs autenticadas | 6.5 | grep sin rateLimit | Upstash contador por user/IP |
| SEC-A05 | AI/Search filter injection | 6.0 | ilike `%${search}%` | Sanitizar `%`, `_`, `\` |
| SEC-A06 | Sin 2FA admin | 6.5 | — | Supabase MFA |
| SEC-A07 | Audit incompleto | 6.0 | solo algunos inserts | `security_events` + panel |
| SEC-A08 | Security headers ausentes | 5.5 | next.config | CSP, X-Frame-Options, etc. |

### 3.2 Media severidad

| ID | Vulnerabilidad | Remediación |
|----|----------------|-------------|
| SEC-M01 | Logs GPS con PII | Redactar prod |
| SEC-M02 | Mock GPS mobile no bloquea | Rechazar telemetry si mock=true |
| SEC-M03 | Share location token brute force | Rate limit + token length |
| SEC-M04 | AsyncStorage mobile tokens | expo-secure-store |
| SEC-M05 | TypeScript build ignored | CI gate |
| SEC-M06 | Realtime RLS drift | Tests automatizados |
| SEC-M07 | API keys sin UI rotación | Settings panel |
| SEC-M08 | Sin WAF / bot protection | Cloudflare optional |

### 3.3 Baja severidad

| ID | Vulnerabilidad |
|----|----------------|
| SEC-L01 | Health endpoint info disclosure |
| SEC-L02 | Sin certificate pinning mobile |
| SEC-L03 | Password min 8 chars only |
| SEC-L04 | Sin IP allowlist enterprise |

---

## 4. Cambios realizados (esta fase)

**Ningún cambio de código en Prompt 4** — auditoría y documentación únicamente.

Documentos generados:
- `SEGURIDAD_TRACKPROGPS.md` (este archivo)
- `PLAN_RESPUESTA_INCIDENTES.md`
- `CHECKLIST_SEGURIDAD.md`

---

## 5. Plan de hardening recomendado

### Ola 1 — Quick wins (1–2 semanas, sin romper compat)

| # | Cambio | Impacto |
|---|--------|---------|
| 1 | Rate limit `register`, `login`, `mobile/telemetry` | Anti-abuso |
| 2 | Sanitizar search en vehicles/drivers/AI | Anti-injection |
| 3 | Security headers en `next.config.js` | XSS/clickjacking |
| 4 | Middleware RBAC rutas `/admin`, `/billing` | Autorización |
| 5 | Rechazar telemetry `mock_location=true` (configurable) | GPS fake |
| 6 | Redactar logs gps-server prod | PII |

### Ola 2 — Enterprise auth (2–4 semanas)

| # | Cambio |
|---|--------|
| 7 | Supabase MFA (2FA) obligatorio admin |
| 8 | Panel sesiones activas + cierre remoto web |
| 9 | `security_events` table + panel auditoría |
| 10 | API keys UI + rotación |

### Ola 3 — GPS & mobile hardening (4–6 semanas)

| # | Cambio |
|---|--------|
| 11 | Alerta IMEI desconocido + auto-quarantine |
| 12 | Fly TCP connection rate limit |
| 13 | Mobile: root/jailbreak warning + SecureStore |
| 14 | Certificate pinning (opcional enterprise) |

### Ola 4 — Infra enterprise (6–12 semanas)

| # | Cambio |
|---|--------|
| 15 | WAF Cloudflare |
| 16 | SSO SAML |
| 17 | SIEM / alertas seguridad |
| 18 | Pen test externo |

---

## 6. Políticas de seguridad

### 6.1 Contraseñas

- Mínimo 8 caracteres (recomendado subir a 12 enterprise)
- Supabase breach detection habilitado
- Rotación forzada tras incidente

### 6.2 Acceso

- Principio mínimo privilegio por rol
- Service role **nunca** en cliente
- API keys: permisos mínimos, rotación 90 días

### 6.3 Datos de ubicación

- Clasificación: **confidencial**
- Retención: 1 año historial (configurable enterprise)
- Export solo roles autorizados
- Share links: expiración máx 24h default

### 6.4 Dispositivos GPS

- IMEI debe pre-registrarse antes de aceptar datos
- Comandos remotos solo roles `supervisor+`
- Logs de comandos en `device_commands`

### 6.5 Desarrollo seguro

- Secrets en env, nunca en repo
- PR review obligatorio
- Dependency audit mensual
- Type-check en CI antes de deploy

### 6.6 Respuesta a incidentes

Ver [`PLAN_RESPUESTA_INCIDENTES.md`](./PLAN_RESPUESTA_INCIDENTES.md).

---

## 7. Cifrado y protección de datos

| Dato | En tránsito | En reposo |
|------|-------------|-----------|
| Web/API | TLS 1.2+ | N/A |
| GPS TCP | Sin TLS* | Postgres encrypted |
| Passwords | TLS | bcrypt (Supabase Auth) |
| API keys | TLS | SHA256 hash |
| JWT | TLS | Supabase managed |
| Ubicaciones | TLS | Postgres RLS |
| Tokens push | TLS | DB encrypted |

*Teltonika: mitigar con VPN/private link enterprise.

---

## 8. Pruebas de seguridad recomendadas

| Prueba | Herramienta | Frecuencia |
|--------|-------------|------------|
| OWASP ZAP baseline | CI weekly | Automático |
| SQL injection manual | API search params | Por release |
| Auth bypass | Postman/curl | Por release |
| RLS cross-tenant | SQL tests | Por migración |
| Mobile OWASP MASVS L1 | Manual | Trimestral |
| Load/abuse register | k6 | Pre-ola-1 |
| Stripe webhook replay | Manual | Anual |

Ver checklist en [`CHECKLIST_SEGURIDAD.md`](./CHECKLIST_SEGURIDAD.md).

---

## 9. Matriz de cumplimiento orientativa

| Requisito enterprise | Estado | Target |
|---------------------|--------|--------|
| Autenticación fuerte | Parcial | +2FA |
| Autorización granular | Parcial | RBAC middleware |
| Auditoría | Parcial | Panel completo |
| Cifrado tránsito | ✓ web | + VPN GPS opt |
| Backups | ✓ Supabase | + restore tests |
| IR plan | ✓ documentado | + drills |
| Pen test | ✗ | Anual |
| SOC2 propio | ✗ | Heredar Supabase/Vercel |

---

## 10. Referencias

- [`RIESGOS_Y_MEJORAS_TRACKPROGPS.md`](./RIESGOS_Y_MEJORAS_TRACKPROGPS.md)
- [`ENTERPRISE_SEGURIDAD_UX.md`](./ENTERPRISE_SEGURIDAD_UX.md)
- [`MOBILE_TRACKING.md`](./MOBILE_TRACKING.md)
- [`PLAN_RESPUESTA_INCIDENTES.md`](./PLAN_RESPUESTA_INCIDENTES.md)
- [`CHECKLIST_SEGURIDAD.md`](./CHECKLIST_SEGURIDAD.md)

---

*Auditoría Prompt 4 — preparado para fase de implementación hardening bajo aprobación.*
