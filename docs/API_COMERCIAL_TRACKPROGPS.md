# API comercial — TrackProGPS

**Versión:** 1.0 · Junio 2026  
**Estado:** Tabla `api_keys` implementada; REST `/api/v1` especificada — pendiente implementación

---

## 1. Visión

Exponer TrackProGPS como **plataforma integrable** para ERP, CRM, TMS, apps logísticas y sistemas enterprise del cliente — dentro del mismo ecosistema, gated por plan `api_access`.

---

## 2. Estado actual vs target

| Componente | Actual | Target |
|------------|--------|--------|
| Tabla `api_keys` | ✅ company_id, key_hash, permissions | + scopes granulares |
| Auth API Key | ❌ | Header `X-API-Key` |
| `/api/v1/*` | ❌ Spec only | Implementar |
| Webhooks salientes | ❌ | POST eventos a URL cliente |
| Rate limiting | ❌ | Por plan |
| Documentación Swagger | ❌ Spec markdown | `/api/docs` OpenAPI |
| UI gestión keys | ❌ | Settings → API |
| Audit API calls | ❌ | `api_request_logs` |

**Spec existente:** [`ENTERPRISE_API_PUBLICA.md`](./ENTERPRISE_API_PUBLICA.md)  
**API interna actual:** [`API.md`](./API.md)

---

## 3. Autenticación

### 3.1 API Keys

```sql
api_keys (
  id, company_id, name,
  key_hash,           -- SHA256, nunca plaintext en DB
  key_prefix,         -- tpro_live_abc... (display)
  permissions jsonb,  -- ["read:vehicles", "write:commands"]
  is_active,
  last_used_at,
  expires_at,
  created_by
)
```

### 3.2 Formato key

```
tpro_live_{32_random_chars}   -- producción
tpro_test_{32_random_chars}   -- sandbox
```

### 3.3 Request

```http
GET /api/v1/vehicles HTTP/1.1
Host: trackprogps.mx
X-API-Key: tpro_live_abc123...
Accept: application/json
```

### 3.4 Validación (target middleware)

```
1. Extract X-API-Key header
2. SHA256(key) → lookup api_keys WHERE key_hash AND is_active
3. Check company plan features.api_access
4. Check permissions vs endpoint scope
5. Rate limit by company_id + plan
6. Log request → api_request_logs
7. Attach company context (service client scoped)
```

### 3.5 Creación key (admin UI)

```
POST /api/settings/api-keys
Authorization: Cookie (admin_empresa + api_access)
Body: {
  "name": "ERP SAP Producción",
  "permissions": ["read:vehicles", "read:positions", "read:history"],
  "expires_at": "2027-06-01T00:00:00Z"
}
Response: {
  "key": "tpro_live_...",  // solo una vez
  "prefix": "tpro_live_abc",
  "id": "uuid"
}
```

---

## 4. Rate limits por plan

| Plan | Límite | Burst |
|------|--------|-------|
| Profesional | 500 req/h | 50/min |
| Empresarial | 5,000 req/h | 200/min |
| Enterprise | Negociado | Custom |

**Headers respuesta:**

```http
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 1718640000
```

**HTTP 429** cuando excedido; incluir `Retry-After`.

**Implementación:** Upstash Redis counter (mismo Redis BullMQ o instancia separada).

---

## 5. Endpoints API v1 (catálogo)

Base: `https://trackprogps.mx/api/v1`

### 5.1 Lectura — Flota

| Método | Endpoint | Descripción | Scope |
|--------|----------|-------------|-------|
| GET | `/vehicles` | Lista vehículos | read:vehicles |
| GET | `/vehicles/{id}` | Detalle vehículo | read:vehicles |
| GET | `/vehicles/{id}/position` | Última posición | read:positions |
| GET | `/vehicles/{id}/history` | Historial ruta | read:history |
| GET | `/devices` | Dispositivos GPS | read:devices |
| GET | `/drivers` | Conductores | read:drivers |

### 5.2 Lectura — Operación

| Método | Endpoint | Descripción | Scope |
|--------|----------|-------------|-------|
| GET | `/alerts` | Alertas paginadas | read:alerts |
| GET | `/geofences` | Geocercas | read:geofences |
| GET | `/trips` | Viajes | read:trips |
| GET | `/reports/km` | KM por periodo | read:reports |

### 5.3 Escritura — Comandos

| Método | Endpoint | Descripción | Scope |
|--------|----------|-------------|-------|
| POST | `/devices/{id}/commands` | Enviar comando GPS | write:commands |
| GET | `/devices/{id}/commands` | Estado comandos | read:commands |

**Reutilizar:** lógica existente en `/api/devices/[id]/commands`.

### 5.4 Mobile (integraciones)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/mobile/devices` | Dispositivos mobile |
| GET | `/mobile/events` | Eventos SOS, check-in |

### 5.5 Admin (enterprise)

| Método | Endpoint | Scope |
|--------|----------|-------|
| GET | `/usage` | Consumo plan | read:admin |
| GET | `/users` | Usuarios tenant | read:users |

---

## 6. Formato respuesta estándar

### Éxito paginado

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 234,
    "total_pages": 5
  }
}
```

### Error

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Límite de 5000 req/h excedido",
    "retry_after": 3600
  }
}
```

### Códigos HTTP

| Code | Uso |
|------|-----|
| 200 | OK |
| 201 | Created |
| 400 | Validation error |
| 401 | Missing/invalid API key |
| 403 | Plan o permission denied |
| 404 | Resource not found |
| 429 | Rate limit |
| 500 | Server error |

---

## 7. Webhooks (eventos salientes)

### 7.1 Configuración

```sql
webhook_endpoints (
  id, company_id, url, secret,
  events text[],      -- ['alert.created', 'vehicle.position_updated']
  is_active,
  failure_count,
  last_success_at
)
```

```
POST /api/settings/webhooks
Body: {
  "url": "https://erp.cliente.com/hooks/trackpro",
  "events": ["alert.created", "geofence.enter", "geofence.exit"],
  "secret": "whsec_..."
}
```

### 7.2 Payload evento

```json
{
  "id": "evt_uuid",
  "type": "alert.created",
  "created_at": "2026-06-17T12:00:00Z",
  "company_id": "uuid",
  "data": {
    "alert_id": "uuid",
    "vehicle_id": "uuid",
    "type": "speed",
    "severity": "high",
    "message": "Exceso de velocidad: 120 km/h"
  }
}
```

### 7.3 Firma HMAC

```http
X-TrackPro-Signature: sha256=abc123...
X-TrackPro-Timestamp: 1718640000
```

Verificación: `HMAC-SHA256(secret, timestamp + body)`.

### 7.4 Eventos disponibles (target)

| Evento | Trigger |
|--------|---------|
| `vehicle.position_updated` | Upsert vehicle_positions |
| `alert.created` | INSERT alerts |
| `geofence.enter` | Geofence RPC |
| `geofence.exit` | Geofence RPC |
| `device.online` | gps_devices status |
| `device.offline` | Cron / disconnect |
| `command.completed` | device_commands ACK |
| `mobile.sos` | mobile_events |
| `subscription.updated` | Stripe webhook (admin) |

**Implementación:** worker `webhook-dispatcher` en cola BullMQ separada de GPS.

---

## 8. Integraciones objetivo

| Sistema | Caso de uso | Endpoints |
|---------|-------------|-----------|
| **SAP / ERP** | Posiciones + alertas → órdenes | GET positions, webhooks |
| **Salesforce CRM** | Estado flota en cuenta cliente | GET vehicles, alerts |
| **WMS / TMS** | ETA entregas | GET history, geofences |
| **Power BI** | Dashboard ejecutivo | GET reports, export CSV |
| **Slack / Teams** | Alertas operativas | Webhook alert.created |
| **Zapier / Make** | Automatizaciones no-code | API v1 + webhooks |

---

## 9. Sandbox y versionado

### 9.1 Sandbox

- Keys `tpro_test_*` → datos demo o tenant sandbox
- Sin efectos en dispositivos reales (commands blocked)
- Rate limit reducido para desarrollo

### 9.2 Versionado

```
/api/v1/...  — estable, breaking changes → v2
Header: Accept: application/vnd.trackpro.v1+json
Deprecation: Sunset header 6 meses antes
```

---

## 10. Seguridad API comercial

| Control | Implementación |
|---------|----------------|
| Keys hashed | SHA256 ✅ |
| HTTPS only | Vercel ✅ |
| Scope mínimo | permissions array |
| Rotation | UI revoke + create new |
| IP allowlist | Enterprise optional |
| Audit | api_request_logs |
| Plan gate | features.api_access |

Ver [`SEGURIDAD_TRACKPROGPS.md`](./SEGURIDAD_TRACKPROGPS.md).

---

## 11. Documentación developer

### 11.1 Entregables

| Recurso | URL target |
|---------|------------|
| OpenAPI 3.1 | `/api/docs/openapi.json` |
| Swagger UI | `/api/docs` |
| Postman collection | Download en docs |
| Quickstart | docs/API_COMERCIAL + ejemplos curl |
| Changelog | `/api/docs/changelog` |

### 11.2 Ejemplo quickstart

```bash
# Listar vehículos
curl -s https://trackprogps.mx/api/v1/vehicles \
  -H "X-API-Key: tpro_live_YOUR_KEY" | jq .

# Última posición
curl -s https://trackprogps.mx/api/v1/vehicles/VEHICLE_ID/position \
  -H "X-API-Key: tpro_live_YOUR_KEY" | jq .
```

---

## 12. Roadmap implementación

| Fase | Entregable | Dependencia |
|------|------------|-------------|
| API-1 | Middleware auth API key | api_keys table ✅ |
| API-2 | GET /v1/vehicles, /position | Reuse internal routes |
| API-3 | Rate limit Redis | Upstash |
| API-4 | UI settings API keys | Plan gate |
| API-5 | Webhooks dispatcher | BullMQ queue |
| API-6 | OpenAPI + Swagger UI | — |
| API-7 | Remaining v1 endpoints | Incremental |
| API-8 | Sandbox keys | Demo tenant |

**Principio:** cada endpoint v1 delega a lógica existente en `/api/*` — zero duplicación business logic.

---

## 13. Facturación API

| Plan | Incluido | Overage |
|------|----------|---------|
| Empresarial | 5,000 req/h | $0.001/req extra (target) |
| Enterprise | Negociado | Incluido en contrato |

Metering vía `api_request_logs` agregado mensual → Stripe usage record.

---

## 14. Referencias

- [`ENTERPRISE_API_PUBLICA.md`](./ENTERPRISE_API_PUBLICA.md) — spec detallada v1
- [`API.md`](./API.md) — API interna sesión cookie
- [`SISTEMA_PLANES_TRACKPROGPS.md`](./SISTEMA_PLANES_TRACKPROGPS.md) — api_access flag
- [`ARQUITECTURA_SAAS_TRACKPROGPS.md`](./ARQUITECTURA_SAAS_TRACKPROGPS.md)

---

*Prompt 6 — Fase 13 documentada. Implementación v1 = extensión de APIs existentes.*
