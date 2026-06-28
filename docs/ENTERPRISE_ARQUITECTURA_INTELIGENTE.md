# TrackProGPS Enterprise — Fase 1: Arquitectura inteligente

**Versión:** 1.0 · **Fecha:** Junio 2026  
**Estado:** Estrategia aprobada para implementación — **documentar antes de programar**  
**Alcance:** Post-GPS físico + Mobile + auditoría técnica

---

## 1. Punto de partida (estado actual)

TrackProGPS es hoy un **SaaS multi-tenant** operativo con:

| Capa | Tecnología | Estado |
|------|------------|--------|
| Ingesta GPS hardware | Node.js + Teltonika TCP + BullMQ | Producción |
| Ingesta móvil | Next.js API `/api/mobile/*` | Producción |
| Datos | Supabase Postgres + PostGIS + Realtime | Producción |
| Web | Next.js 14 Vercel | Producción |
| Mobile | Expo 51 | Desarrollo/EAS |
| IA básica | Claude `/api/ai/chat` (4 tools) | Producción (plan-gated) |
| Automatización parcial | `alert_rules` + workers | Producción |
| API keys | Tabla `api_keys` (sin REST público) | Schema only |
| Reportes | CSV/PDF + RPC km-stats | Producción |

**Principio rector:** Toda evolución enterprise se **acopla** a esta arquitectura. No se crea plataforma paralela.

---

## 2. Visión enterprise

Convertir TrackProGPS de **rastreo reactivo** a **gestión inteligente de movilidad**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA EXPERIENCIA                              │
│  Web dashboard │ Mobile │ API pública │ White-label │ Reportes  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    TRACKPRO AI                                   │
│  NL queries │ Anomalías │ Predictivo │ Reportes auto │ Rutas    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              MOTOR DE AUTOMATIZACIÓN (Playbooks)                 │
│  SI evento → ENTONCES acción (alerta, webhook, comando, IA)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              ANALÍTICA + IoT + TELEMETRÍA                        │
│  KPIs │ TSDB views │ Sensores │ OBD │ Event stream              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              CORE EXISTENTE (sin romper)                         │
│  Teltonika │ Mobile │ Supabase │ gps-server │ Realtime          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Estrategia por pilar

### 3.1 Inteligencia artificial (TrackPro AI)

**Enfoque:** IA como **capa de lectura + orquestación**, nunca en hot path de ingesta GPS.

| Componente | Dónde vive | Por qué |
|------------|------------|---------|
| Asistente NL | `apps/web` + API `/api/ai/*` | Ya existe; expandir tools |
| Anomalías | Jobs batch (Edge/cron) + tabla `ai_insights` | No bloquea TCP :5000 |
| Predictivo | Vistas materializadas + ML ligero | Postgres-first; ML cloud después |
| Reportes IA | Cola `report-generation` | Reutiliza `generated_reports` |

**Modelo:** Anthropic Claude (actual) + embeddings opcionales (Supabase pgvector) para memoria empresa.

**Guardrails:**
- Tools con SQL parametrizado validado (no SQL libre del LLM)
- Rate limit por `company_id` y plan
- Audit log de consultas IA

### 3.2 Analítica avanzada

**Fase inicial:** ampliar dashboard con KPIs desde RPCs existentes + nuevas vistas materializadas.

| KPI | Fuente datos | Complejidad |
|-----|--------------|-------------|
| Km recorridos | `position_history` / odómetro | Baja |
| Tiempo operativo vs detenido | RPC idle stats (019) | Media |
| Eventos críticos | `alerts` agregado | Baja |
| Costos estimados | `fuel-utils` + km | Media |
| Ranking operadores | `drivers` + historial | Media |

**Fase escala:** réplica read-only + Timescale/ClickHouse para agregados históricos >90 días.

### 3.3 Automatización

**Estado actual:** `alert_rules` + workers = reglas **reactivas** por posición.

**Evolución:** Motor **Playbooks** (SI/ENTONCES compuesto):

```
Trigger (evento GPS, alerta, geocerca, IoT, horario, IA)
    → Condiciones (AND/OR, ventana temporal)
    → Acciones (notificar, webhook, comando, crear ticket, IA summary)
```

Implementación sugerida: tabla `automation_playbooks` + worker que consume cola `automation-actions` (misma Redis BullMQ).

**Compatibilidad:** `alert_rules` sigue funcionando; playbooks las envuelven o migran gradualmente.

### 3.4 IoT y sensores

**Patrón:** Extender `raw_io` (Teltonika) + tabla `telemetry_events` para eventos no-posicionales.

```
Decoder Teltonika/Mobile → position (existente)
                        → telemetry_events (nuevo: temp, puerta, OBD)
                        → alert-checks (existente, ampliado)
```

**Abstracción:** `packages/telemetry` con interface `TelemetryAdapter` por fabricante/sensor.

### 3.5 Integraciones externas

| Integración | Uso | Prioridad |
|-------------|-----|-----------|
| Webhooks salientes | ERP, Slack, TMS | P1 |
| API REST pública | Partners | P1 |
| Stripe | Billing (existente) | — |
| Google Maps Directions | Rutas | P2 |
| Resend | Email (existente) | — |
| Videotelemática | Dashcam partners | P3 |

### 3.6 Modelos comerciales

Ya existen: `plans`, `features` (ai_assistant, api_access, white_label).

**Ampliar planes enterprise:**

| Feature flag | Descripción |
|--------------|-------------|
| `ai_assistant` | TrackPro AI (existente) |
| `ai_reports` | Reportes automáticos |
| `ai_anomalies` | Detección anomalías |
| `api_access` | API pública (existente) |
| `automation_playbooks` | Motor SI/ENTONCES |
| `iot_sensors` | Telemetría extendida |
| `white_label` | Marca propia (existente) |
| `route_optimization` | Optimización rutas |

---

## 4. Arquitectura de datos inteligente

### 4.1 Capas de almacenamiento (evolutivo)

| Escala | Hot (operacional) | Warm (analítica) | Cold (archivo) |
|--------|-------------------|------------------|----------------|
| <10k devices | Supabase Postgres | Vistas materializadas | Particiones + DROP |
| 10k–100k | Postgres + read replica | Timescale o ClickHouse | S3 Parquet |
| 100k–1M | Stream (Kafka/Redpanda) | TSDB dedicado | Data lake |

**Hoy:** permanecer en Postgres con batch jobs nocturnos.

### 4.2 Nuevas entidades propuestas (sin romper schema)

| Tabla | Propósito |
|-------|-----------|
| `ai_conversations` | Historial asistente por usuario |
| `ai_insights` | Anomalías, predicciones, scores |
| `ai_scheduled_reports` | Reportes IA programados |
| `telemetry_events` | IoT no-GPS |
| `automation_playbooks` | Reglas SI/ENTONCES |
| `automation_runs` | Auditoría ejecuciones |
| `webhook_endpoints` | Integraciones salientes |
| `feature_snapshots` | KPIs diarios pre-calculados |

Todas con `company_id` + RLS.

### 4.3 Pipeline de eventos unificado

```
Fuentes: Teltonika │ Mobile │ IoT │ Alertas │ Geocercas │ IA
                    │
                    ▼
            event_bus (BullMQ topic o pg NOTIFY)
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Alert worker  Playbook   Analytics
                 engine     aggregator
```

---

## 5. Principios de no-regresión

1. **gps-server Teltonika:** cero cambios en decoder salvo registry de adapters.
2. **Mobile API:** contrato `/api/mobile/*` versionado (v1 estable).
3. **RLS multi-tenant:** toda tabla nueva con `company_id`.
4. **Realtime mapa:** no aumentar payload; agregados vía API separada.
5. **Planes:** features off by default; enterprise opt-in.

---

## 6. Orden de implementación recomendado

| Orden | Módulo | Esfuerzo | Impacto |
|-------|--------|----------|---------|
| 1 | TrackPro AI — expandir tools + historial | 2–3 sem | Alto |
| 2 | Dashboard KPIs + `feature_snapshots` | 2 sem | Alto |
| 3 | Playbooks v1 (webhook + alerta compuesta) | 3 sem | Alto |
| 4 | API pública v1 + Swagger | 2 sem | Medio |
| 5 | Anomalías batch (desvío ruta, paradas) | 3 sem | Alto |
| 6 | IoT `telemetry_events` | 2 sem | Medio |
| 7 | Optimización rutas (Google Directions) | 3 sem | Medio |
| 8 | White-label config | 2 sem | Medio |
| 9 | Escala stream pipeline | 8+ sem | Crítico a 100k+ |

---

## 7. Riesgos de la evolución

| Riesgo | Mitigación |
|--------|------------|
| Costos API Claude | Quotas por plan, cache respuestas |
| Postgres saturado por IA/analytics | Vistas + réplica; TSDB a 10k+ |
| Complejidad playbooks | UI wizard; templates predefinidos |
| Scope creep videotelemática | Solo arquitectura hasta partner |
| Romper mobile/hardware | Contratos API versionados + tests |

---

## 8. Referencias internas

- [`ANALISIS_ARQUITECTURA_TRACKPROGPS.md`](./ANALISIS_ARQUITECTURA_TRACKPROGPS.md)
- [`MAPA_SISTEMA_TRACKPROGPS.md`](./MAPA_SISTEMA_TRACKPROGPS.md)
- [`MOBILE_TRACKING.md`](./MOBILE_TRACKING.md)
- [`TRACKPRO_AI_SPEC.md`](./TRACKPRO_AI_SPEC.md)
- [`ENTERPRISE_ROADMAP_FUTURO.md`](./ENTERPRISE_ROADMAP_FUTURO.md)

---

*Documento estratégico — implementación pendiente de aprobación por fase.*
