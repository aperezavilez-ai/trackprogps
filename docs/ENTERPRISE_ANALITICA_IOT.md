# TrackProGPS Enterprise — Analítica, IoT y Videotelemática

**Fases:** 3 (Analítica) · 4 (Rutas) · 5 (IoT) · 6 (Video)  
**Estado:** Diseño — sin implementación

---

## Fase 3 — Analítica avanzada

### 3.1 Dashboard empresarial (`/analytics` propuesto)

**KPIs principales:**

| KPI | Cálculo | Fuente |
|-----|---------|--------|
| Kilómetros recorridos | Δ odómetro o haversine | `position_history` |
| Tiempo operativo | Σ intervalos speed > 2 + ignition | history |
| Tiempo detenido | RPC `get_idle_stats_for_vehicles` | 018/019 |
| Conductores activos | drivers con posición hoy | join |
| Vehículos disponibles | status active + online | vehicles + positions |
| Eventos críticos | alerts severity critical/high | alerts |
| Rendimiento operador | km / tiempo activo | agregado |
| Costos estimados | km × costo/km o combustible | fuel-utils + config |

### 3.2 Visualizaciones

- **Gráficas:** Recharts (ya en stack web) — líneas tendencia 7/30/90 días
- **Comparativas:** periodo actual vs anterior
- **Rankings:** top/bottom 10 unidades, operadores, grupos
- **Mapa calor:** densidad paradas (PostGIS ST_ClusterDBSCAN)

### 3.3 Vista materializada propuesta

```sql
CREATE MATERIALIZED VIEW fleet_daily_stats AS
SELECT
  company_id,
  vehicle_id,
  date_trunc('day', recorded_at) AS day,
  COUNT(*) AS point_count,
  MAX(speed) AS max_speed,
  AVG(speed) FILTER (WHERE speed > 2) AS avg_speed,
  -- km via odometer delta en window functions
  ...
FROM position_history
GROUP BY 1, 2, 3;

-- Refresh: pg_cron 0 2 * * *
```

### 3.4 API

- `GET /api/analytics/overview?period=7d`
- `GET /api/analytics/rankings?metric=km|idle|alerts`
- `GET /api/analytics/trends?vehicle_id&from&to`

---

## Fase 4 — Optimización de rutas

### 4.1 Capacidades

| Función | v1 | v2 |
|---------|----|----|
| Ordenar paradas (TSP simple) | Heurística nearest-neighbor | Google OR-Tools |
| ETA por tramo | Haversine + factor urbano | Google Directions API |
| Tráfico tiempo real | — | Google Traffic Layer |
| Reducir km/combustible | Comparar ruta real vs óptima | IA sugerencias |

### 4.2 Modelo de datos

```sql
CREATE TABLE route_plans (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  name varchar(200),
  vehicle_id uuid,
  waypoints jsonb NOT NULL, -- [{lat, lng, label, order, eta}]
  optimized_order jsonb,
  total_km_est numeric,
  total_time_min int,
  status varchar(20) DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
```

### 4.3 Integraciones mapas

| Servicio | Uso |
|----------|-----|
| Google Directions API | Rutas + ETA |
| Google Distance Matrix | Múltiples orígenes/destinos |
| Reverse geocode existente | Etiquetas paradas |

### 4.4 UI

- Wizard en `/routes/plan` — importar paradas CSV o clic mapa
- Comparativa: ruta ejecutada (history) vs planificada

---

## Fase 5 — IoT y sensores

### 5.1 Arquitectura modular

```
┌─────────────────────────────────────────┐
│         TelemetryAdapter (interface)       │
├─────────────┬─────────────┬───────────────┤
│ TeltonikaIO │ MobileExt   │ ObdCanAdapter │
│ (raw_io)    │ (metadata)  │ (future)      │
└──────┬──────┴──────┬──────┴───────┬───────┘
       │             │              │
       └─────────────┼──────────────┘
                     ▼
            telemetry_events table
                     │
                     ▼
         alert-checks / playbooks / analytics
```

### 5.2 Tipos de sensor

| Sensor | IO Teltonika | Event type |
|--------|--------------|------------|
| Combustible | 48, 89 | `fuel_level` |
| Temperatura | 72 | `temperature` |
| Puerta | 249 | `door_open` |
| Humedad | BLE ext | `humidity` |
| OBD-II | CAN adapter | `obd_*` |
| RFID | BLE | `rfid_scan` |

### 5.3 Schema `telemetry_events`

```sql
CREATE TABLE telemetry_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  device_id uuid NOT NULL,
  vehicle_id uuid,
  event_type varchar(50) NOT NULL,
  value_numeric numeric,
  value_text text,
  unit varchar(20),
  raw_payload jsonb,
  recorded_at timestamptz NOT NULL,
  server_at timestamptz DEFAULT now()
);
PARTITION BY RANGE (recorded_at); -- mismo patrón position_history
```

### 5.4 Registro dispositivo IoT

Extender `gps_devices`:
- `capabilities jsonb` — lista sensores soportados
- Sin cambiar `source_type` hardware/mobile

---

## Fase 6 — Videotelemática (preparación)

### 6.1 Alcance futuro

- Dashcams con GPS integrado (Jimii, Streamax, etc.)
- Eventos: fatiga, distracción, colisión, adelantamiento
- Clips de video vinculados a `alerts.id`

### 6.2 Arquitectura target

```
Cámara → cloud vendor API → webhook TrackPro
                              │
                              ▼
                    video_events + alert
                              │
                              ▼
                    S3/Supabase Storage (clip URL)
```

### 6.3 Schema preparatorio

```sql
CREATE TABLE video_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  alert_id uuid REFERENCES alerts(id),
  vendor varchar(50),
  event_type varchar(50),
  clip_url text,
  thumbnail_url text,
  duration_sec int,
  recorded_at timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'
);
```

**Implementación:** solo schema + webhook stub hasta acuerdo con fabricante.

---

## Compatibilidad

- GPS Teltonika: `raw_io` ya captura IO elements — mapear a `telemetry_events` en worker
- Mobile: sensores teléfono (batería, actividad) ya en `raw_io.mobile`
- Alertas/geocercas: mismos workers, nuevos tipos en `alert_rules`

---

*Ver [`ENTERPRISE_AUTOMATIZACION_ESCALA.md`](./ENTERPRISE_AUTOMATIZACION_ESCALA.md) para playbooks y escala.*
