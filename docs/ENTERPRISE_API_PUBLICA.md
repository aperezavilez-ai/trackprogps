# TrackProGPS — API pública (especificación v1)

**Estado:** Especificación — implementación pendiente  
**Base URL:** `https://trackprogps.mx/api/v1`  
**Auth:** Header `X-API-Key: tpro_live_xxxxxxxx`

---

## 1. Autenticación

### Crear API Key (admin)

```
POST /api/settings/api-keys
Authorization: Cookie (sesión web)
Body: { "name": "ERP Producción", "permissions": ["read", "read:history"] }
Response: { "key": "tpro_live_...", "prefix": "tpro_liv" }  // key solo una vez
```

### Usar API Key

```http
GET /api/v1/vehicles HTTP/1.1
Host: trackprogps.mx
X-API-Key: tpro_live_abc123...
Accept: application/json
```

---

## 2. Rate limits

| Plan | Límite |
|------|--------|
| Profesional | 500 req/h |
| Empresarial | 5,000 req/h |
| Custom | Negociado |

Headers respuesta:
```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 1718640000
```

---

## 3. Endpoints

### GET /vehicles

Lista vehículos de la empresa.

```json
{
  "data": [{
    "id": "uuid",
    "economic_num": "ECO-001",
    "plates": "ABC-123",
    "status": "active",
    "device": { "source_type": "hardware", "status": "online" },
    "position": { "lat": 19.43, "lng": -99.13, "speed": 45, "recorded_at": "..." }
  }],
  "meta": { "count": 1 }
}
```

### GET /vehicles/{id}/position

Posición actual.

### GET /vehicles/{id}/history

Query: `from`, `to` (ISO8601, max 7 días)

### GET /devices

Lista dispositivos GPS y móviles.

### GET /alerts

Query: `severity`, `acknowledged`, `from`, `to`, `page`

### GET /events

Eventos móviles e IoT (`mobile_events`, `telemetry_events` futuro).

---

## 4. Webhooks (salientes)

Configurados vía Playbooks o `/api/v1/webhooks`:

```json
POST https://cliente.com/trackpro-hook
{
  "event": "alert.created",
  "company_id": "...",
  "timestamp": "...",
  "data": { "alert_id": "...", "type": "speed_excess", ... }
}
```

Firma: `X-TrackPro-Signature: sha256=...` (HMAC con secret del webhook).

---

## 5. Errores

| Código | Significado |
|--------|-------------|
| 401 | API key inválida o expirada |
| 403 | Permiso insuficiente |
| 429 | Rate limit |
| 422 | Parámetros inválidos |

```json
{ "error": "Invalid API key", "code": "auth_invalid_key" }
```

---

## 6. OpenAPI

Archivo propuesto: `apps/web/public/openapi/v1.yaml`

UI: `https://trackprogps.mx/developers`

Generar desde spec:
```bash
npx @redocly/cli build-docs openapi/v1.yaml -o public/developers/index.html
```

---

## 7. Diferencia con API interna

| | API interna (`/api/*`) | API pública v1 |
|--|------------------------|----------------|
| Auth | Cookie Supabase | X-API-Key |
| Uso | Web/Mobile UI | Integraciones |
| Rate limit | Sesión | Por key |
| Estabilidad | Puede cambiar | Versionada |

La API interna documentada en [`API.md`](./API.md) **no cambia** para la UI.

---

## 8. Seguridad

- Keys almacenadas como SHA256 hash
- Solo HTTPS
- Rotación recomendada cada 90 días
- IP allowlist opcional (enterprise)
- Log en `security_events`

---

*Especificación API v1.0 — implementar tras aprobación Fase 9.*
