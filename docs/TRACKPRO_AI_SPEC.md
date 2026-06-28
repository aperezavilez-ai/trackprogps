# TrackPro AI — Especificación técnica (Fase 2)

**Módulo:** TrackPro AI  
**Integración:** Capa sobre arquitectura existente  
**Estado:** Especificación — pendiente implementación

---

## 1. Objetivo

Asistente inteligente en lenguaje natural con acceso seguro a datos reales de flota, más capacidades de análisis predictivo, detección de anomalías y generación automática de reportes.

**Base actual:** `/api/ai/chat` con Claude Sonnet 4.6 y 4 herramientas:
- `get_vehicles_status`
- `get_active_alerts`
- `get_vehicle_location`
- `get_daily_km`

---

## 2. Arquitectura TrackPro AI

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ UI Chat      │────►│ /api/ai/chat    │────►│ Anthropic Claude │
│ AiAssistant  │     │ /api/ai/reports │     └────────┬─────────┘
└──────────────┘     │ /api/ai/insights│              │
                     └────────┬────────┘              │
                              │                         │
                     ┌────────▼────────┐     ┌─────────▼─────────┐
                     │ Tool Registry   │────►│ Supabase (RLS)    │
                     │ (validated SQL) │     │ + materialized    │
                     └─────────────────┘     │   views           │
                                             └───────────────────┘
                              │
                     ┌────────▼────────┐
                     │ ai_insights     │  ← batch jobs (anomalías)
                     │ ai_conversations│
                     │ generated_reports│
                     └─────────────────┘
```

---

## 3. Asistente inteligente — consultas NL

### 3.1 Ejemplos objetivo → herramientas

| Pregunta usuario | Tool(s) requerida(s) |
|------------------|----------------------|
| "¿Dónde estuvo el vehículo 25 ayer?" | `get_vehicle_history` (nueva) |
| "¿Qué unidades excedieron velocidad esta semana?" | `get_speed_violations` (nueva) |
| "¿Qué operadores tienen más tiempo detenido?" | `get_idle_ranking` (nueva) |
| "Genera reporte mensual de mi flotilla" | `generate_fleet_report` (nueva) |
| "Detecta comportamientos anormales" | `get_ai_insights` (nueva) |

### 3.2 Tools a implementar (Fase 2A)

```typescript
// packages/ai-tools/src/registry.ts — propuesto
get_vehicle_history(vehicle_id | identifier, date_from, date_to)
get_speed_violations(date_from, date_to, limit?)
get_idle_ranking(date_from, date_to)
get_geofence_events(date_from, date_to)
get_mobile_devices_status()
get_fleet_summary(period: 'day' | 'week' | 'month')
search_vehicles(query: string)
generate_report_template(type, period) // encola job
get_ai_insights(severity?, type?)
```

**Reglas de seguridad:**
- Cada tool recibe `companyId` del JWT — nunca del LLM
- Identificadores de vehículo resueltos server-side con RLS
- Máximo 7 días de historial por query interactiva (ampliar vía reporte async)
- Log en `ai_conversations` + `audit_logs`

### 3.3 System prompt enterprise (evolución)

```
Eres TrackPro AI, asistente de telemática empresarial.
- Responde en español, tono profesional.
- Usa herramientas para datos reales; nunca inventes coordenadas ni km.
- Si la pregunta es ambigua, pide aclaración (vehículo, fecha).
- Para reportes largos, ofrece generar PDF/email async.
- Indica fuente temporal de los datos ("datos al DD/MM HH:mm").
```

### 3.4 UI

- Expandir `AiAssistantProvider` / `ai-chat.tsx`
- Historial conversación por usuario (`ai_conversations`)
- Sugerencias contextuales según página (mapa, alertas, reportes)
- Badge "TrackPro AI" en sidebar (plan-gated)

---

## 4. Análisis predictivo (Fase 2B)

### 4.1 Casos de uso

| Caso | Señales | Output |
|------|---------|--------|
| Mantenimiento preventivo | km acumulados, horas motor (IO 239) | `ai_insights` tipo `maintenance_risk` |
| Cambio comportamiento | Desviación vs baseline 30d | `behavior_change` |
| Rutas ineficientes | km vs distancia haversine | `route_inefficiency` |
| Consumo anormal | km/L vs histórico | `fuel_anomaly` |
| Riesgo operativo | Score compuesto alertas + velocidad | `risk_score` |

### 4.2 Implementación por fases

**v1 (reglas + estadística):**
- Baselines en vista materializada `fleet_daily_stats`
- Scores con z-score / umbrales configurables
- Job pg_cron diario 02:00

**v2 (ML):**
- Export features → notebook / Vertex / SageMaker
- Modelos ligeros (regresión, isolation forest) offline
- Scores escritos en `ai_insights`

### 4.3 Schema `ai_insights`

```sql
CREATE TABLE ai_insights (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  vehicle_id uuid,
  driver_id uuid,
  insight_type varchar(50) NOT NULL,
  severity alert_severity NOT NULL,
  title varchar(200) NOT NULL,
  summary text NOT NULL,
  score numeric(5,2),
  payload jsonb DEFAULT '{}',
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

---

## 5. Detección de anomalías (Fase 2C)

### 5.1 Tipos detectables

| Anomalía | Algoritmo v1 | Datos |
|----------|--------------|-------|
| Desvío de ruta | Distancia punto→polyline habitual | `position_history` 7d |
| Parada no programada | Cluster paradas >15 min fuera geocerca | history + geofences |
| Horario inusual | Actividad fuera ventana empresa | `companies.settings` |
| Velocidad irregular | Varianza speed alta en tramo | history |
| Separación vehículo-operador | Mobile vs vehículo asignado dist > X km | mobile + GPS |
| Actividad sospechosa | Mock location, root (mobile) | `mobile_events` |

### 5.2 Flujo

```
Cron hourly → anomaly_detector job
  → per company, per vehicle
  → insert ai_insights + optional alert
  → notify si severity >= high
```

**No duplicar:** reutilizar pipeline alertas existente para notificación.

---

## 6. Reportes generados por IA (Fase 2D)

### 6.1 Tipos

| Reporte | Frecuencia | Contenido |
|---------|------------|-----------|
| Resumen diario | 07:00 local | Km, alertas, top unidades |
| Resumen semanal | Lunes | Tendencias, ranking |
| Resumen mensual | Día 1 | Ejecutivo + gráficas |
| Productividad | Bajo demanda | Tiempo movimiento vs parado |
| Seguridad | Bajo demanda | Excesos velocidad, SOS, geocercas |

### 6.2 Pipeline

```
POST /api/ai/reports/generate { type, period }
  → insert generated_reports (existente)
  → BullMQ job ai-report-worker
  → agrega datos + Claude narrative summary
  → PDF (reuse export-report.ts) + email Resend
```

### 6.3 Programación

Tabla `ai_scheduled_reports`:
- `company_id`, `report_type`, `cron`, `recipients[]`, `channels[]`

---

## 7. Límites y costos

| Plan | Consultas IA/día | Reportes IA/mes |
|------|------------------|-----------------|
| Básico | 0 | 0 |
| Profesional | 50 | 4 |
| Empresarial | 500 | 30 |
| Custom | Ilimitado* | Ilimitado* |

*Con rate limit técnico 10 req/min por company.

---

## 8. Plan de pruebas

| Test | Tipo |
|------|------|
| Tools retornan solo datos tenant | Integración |
| Pregunta NL → tool correcta | Eval set 50 preguntas |
| No SQL injection vía LLM | Seguridad |
| Latencia P95 < 8s | Carga |
| Anomalías conocidas detectadas | Fixture histórico |

---

## 9. Dependencias

- `ANTHROPIC_API_KEY` (existente)
- Migraciones: `ai_conversations`, `ai_insights`, `ai_scheduled_reports`
- Feature flags en `plans.features`

---

*Especificación TrackPro AI — ver [`ENTERPRISE_ROADMAP_FUTURO.md`](./ENTERPRISE_ROADMAP_FUTURO.md) para cronograma.*
