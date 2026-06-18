# TrackPro GPS — API Reference

Base URL: `https://trackprogps.mx/api`

Todas las rutas requieren autenticación via cookie de sesión Supabase (login previo)
o un API Key en el header `X-API-Key` (plan Empresarial).

---

## Autenticación

### POST /api/auth/register
Registra una nueva empresa y usuario administrador.

**Body:**
```json
{
  "companyName": "Transportes Demo",
  "companyEmail": "contacto@demo.mx",
  "companyPhone": "+52 55 5555 5555",
  "fullName": "Juan García",
  "email": "admin@demo.mx",
  "password": "minimo8chars"
}
```

**Response 201:**
```json
{ "success": true, "company_id": "uuid" }
```

---

## Vehículos

### GET /api/vehicles
Lista vehículos con paginación.

**Query params:** `page`, `per_page`, `search`, `status`

**Response:**
```json
{
  "data": [{ "id": "uuid", "economic_num": "ECO-001", "plates": "ABC-123", ... }],
  "count": 50,
  "page": 1,
  "per_page": 20,
  "total_pages": 3
}
```

### POST /api/vehicles
Crea un vehículo.

**Body:**
```json
{
  "economic_num": "ECO-001",
  "plates": "ABC-123-X",
  "brand": "Kenworth",
  "model": "T680",
  "year": 2022,
  "type": "truck",
  "color": "Blanco",
  "max_speed": 100
}
```

### PATCH /api/vehicles/:id
Actualiza un vehículo.

### DELETE /api/vehicles/:id
Desactiva (soft delete) un vehículo.

---

## Choferes

### GET /api/drivers
Lista choferes. Query: `page`, `per_page`, `search`

### POST /api/drivers
Crea un chofer.

**Body:**
```json
{
  "full_name": "Juan García López",
  "phone": "+52 55 1111 1111",
  "email": "juan@demo.mx",
  "license_num": "MX-2021-001234",
  "license_exp": "2026-06-15"
}
```

### PATCH /api/drivers/:id — DELETE /api/drivers/:id

---

## Dispositivos GPS

### GET /api/devices
Lista dispositivos. Query: `page`, `per_page`

### POST /api/devices
```json
{
  "imei": "123456789012345",
  "model": "FMC920",
  "sim_iccid": "8952140...",
  "phone_num": "+52 55 ...",
  "firmware_ver": "03.27.07"
}
```

### PATCH /api/devices/:id — DELETE /api/devices/:id

---

## Historial de posiciones

### GET /api/history
Obtiene posiciones de un vehículo en un rango de tiempo.

**Query params (requeridos):** `vehicle_id`, `date_from` (ISO), `date_to` (ISO)
**Query params opcionales:** `simplify=true` (Douglas-Peucker)

**Límite:** máximo 7 días por consulta.

**Response:**
```json
{
  "data": {
    "points": [{ "lat": 19.43, "lng": -99.13, "speed": 65, "heading": 90, "recorded_at": "..." }],
    "stats": {
      "started_at": "...", "ended_at": "...", "duration_min": 120,
      "distance_km": 45.3, "max_speed": 95, "avg_speed": 62
    },
    "total_points": 1440,
    "simplified_points": 287
  }
}
```

---

## Alertas

### GET /api/alerts
Lista alertas. Query: `page`, `per_page`, `severity`, `type`, `unacknowledged=true`, `date_from`, `date_to`

### PATCH /api/alerts
Reconocimiento masivo.
```json
{ "alert_ids": ["uuid1", "uuid2"] }
```

### PATCH /api/alerts/:id
Reconoce una alerta individual.

---

## Geocercas

### GET /api/geofences
Lista geocercas. Query: `active=true`

### POST /api/geofences
```json
{
  "name": "Bodega Central",
  "type": "circular",
  "geometry": { "type": "Point", "coordinates": [-99.1332, 19.4326] },
  "radius_m": 500,
  "color": "#3B82F6",
  "alert_on_enter": true,
  "alert_on_exit": true
}
```

### PATCH /api/geofences/:id — DELETE /api/geofences/:id

---

## Mantenimiento

### GET /api/maintenance
Lista registros. Query: `page`, `per_page`, `vehicle_id`

### GET /api/maintenance/upcoming
Mantenimientos próximos. Query: `days_ahead=30`

### POST /api/maintenance
```json
{
  "vehicle_id": "uuid",
  "type": "oil_change",
  "description": "Cambio de aceite 5W-30 y filtro",
  "cost": 1800,
  "service_date": "2025-01-15",
  "next_service_date": "2025-07-15",
  "next_odometer": 250000,
  "workshop": "Servicio Express"
}
```

---

## Reportes

### GET /api/reports
Genera reporte en CSV o JSON.

**Query params:** `type` (kilometrage|trips|speed|alerts|idle), `date_from`, `date_to`, `format` (csv|json)

### GET /api/reports/km-stats
Estadísticas de km por vehículo via función PostgreSQL.
Query: `date_from`, `date_to`

---

## IA Operativa

### POST /api/ai/chat
Consulta al asistente de flota.

**Body:**
```json
{
  "messages": [
    { "role": "user", "content": "¿Dónde está la unidad ECO-001?" }
  ]
}
```

**Response:**
```json
{
  "message": "La unidad ECO-001 está en lat 19.4326, lng -99.1332, circulando a 65 km/h."
}
```

Requiere plan Empresarial. Accede a herramientas: `get_vehicles_status`, `get_active_alerts`, `get_vehicle_location`, `get_daily_km`.

---

## Facturación

### POST /api/billing/checkout
Inicia checkout de Stripe.
```json
{ "plan_id": "uuid", "billing_period": "monthly" }
```
Response: `{ "checkout_url": "https://checkout.stripe.com/..." }`

### POST /api/billing/portal
Abre portal de gestión de Stripe.
Response: `{ "portal_url": "https://billing.stripe.com/..." }`

---

## Configuración

### PATCH /api/settings/company
Actualiza datos de la empresa.

### POST /api/settings/invite
Invita un usuario al equipo.
```json
{ "email": "nuevo@empresa.mx", "role": "supervisor" }
```

### PATCH /api/settings/notifications
Configura canales de notificación.
```json
{
  "notification_email": "alertas@empresa.mx",
  "whatsapp_phone": "+525512345678"
}
```

---

## Tipos de vehículo
`sedan`, `suv`, `pickup`, `van`, `truck`, `bus`, `motorcycle`, `other`

## Tipos de alerta
`speed_excess`, `gps_disconnect`, `signal_loss`, `power_cut`, `unauthorized_movement`,
`geofence_enter`, `geofence_exit`, `geofence_dwell`, `sos`, `maintenance_due`,
`ignition_on`, `ignition_off`, `battery_low`

## Severidades
`low`, `medium`, `high`, `critical`

## Roles de usuario
`super_admin`, `admin_empresa`, `supervisor`, `operador`, `cliente_consulta`

## Tipos de mantenimiento
`oil_change`, `tire_rotation`, `brake_service`, `tune_up`, `insurance`, `verification`, `other`
