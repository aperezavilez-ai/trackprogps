# Auditoría de rendimiento — TrackProGPS

**Versión:** 1.0 · **Fecha:** Junio 2026  
**Alcance:** gps-server, Supabase, web, mobile, colas, realtime  
**Modo:** Auditoría documental — sin cambios de código en esta fase

---

## 1. Resumen ejecutivo

TrackProGPS tiene una **arquitectura sólida para MVP y flotas SMB (~500 dispositivos)**, con ingesta TCP desacoplada vía BullMQ, particionado mensual de historial y Realtime para mapas. Los **cuellos de botella principales** están en escrituras DB serializadas por registro GPS, fan-out de geocercas PostGIS, Realtime por cada upsert de posición, y **single-instance** del gps-server en Fly.io.

| Escala objetivo | Estado actual | Gap |
|-----------------|---------------|-----|
| 100 dispositivos | ✅ Cómodo | — |
| 1,000 dispositivos | ⚠ Límite operativo | DB writes + geofences |
| 10,000 dispositivos | ❌ Requiere rediseño parcial | Workers separados, batch writes |
| 100,000 dispositivos | ❌ Arquitectura target | TimescaleDB, multi-TCP, cache layer |
| Millones posiciones/día | ⚠ Particiones OK | Batch insert, DROP partition cleanup |

---

## 2. Arquitectura actual y flujo de datos

```
Teltonika TCP :5000 ──► index.ts (decode sync) ──► BullMQ gps-positions
Mobile HTTPS ──► /api/mobile/telemetry ──► processMobileTelemetry (inline)

gps-positions worker (×30) ──► processGpsPosition
  ├── lookup IMEI (cache 5 min)
  ├── por cada registro:
  │     ├── UPSERT vehicle_positions  → Supabase Realtime
  │     ├── INSERT position_history   → partición mensual
  │     └── ENQUEUE alert-checks
  └── UPDATE gps_devices.last_seen

alert-checks worker (×40) ──► processAlertCheck
  ├── reglas (cache 3 min)
  ├── RPC get_geofence_events (PostGIS)
  ├── INSERT alerts
  └── ENQUEUE notifications

notifications worker (×10) ──► email / push / WhatsApp
```

**Infra producción:**
- **Fly.io:** 1 VM, 2 CPU shared, 2 GB RAM — TCP + 3 workers + health + command poller
- **Vercel:** Next.js SSR dinámico, sin cache de datos
- **Supabase:** Postgres + Realtime + Auth
- **Upstash Redis:** BullMQ (obligatorio para arranque)

---

## 3. Análisis por componente

### 3.1 Recepción GPS (TCP)

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| ACK rápido | ✅ | ACK antes de encolar |
| Decode | ⚠ Sync en handler | Bloquea I/O en paquetes grandes |
| Buffer | ✅ | Max 64 KB, timeout 30s |
| Concurrencia TCP | ✅ | Event loop Node |
| Escalamiento horizontal | ❌ | `connections.ts` in-memory por instancia |

**Saturación estimada:** ~50–100 paquetes/s en VM actual antes de presión en event loop + Redis enqueue.

### 3.2 Procesamiento (workers)

| Worker | Concurrencia | Retries | Retención jobs |
|--------|--------------|---------|----------------|
| gps-positions | **30** | 3 exp 1s | 5,000 |
| alert-checks | **40** | 2 fixed 500ms | 10,000 |
| notifications | **10** | 5 exp 2s | 10,000 |

**Nota:** `docs/ARCHITECTURE.md` lista 10/20/5 — **desactualizado**; código real 30/40/10.

**Problema crítico:** cada registro Teltonika genera **2–3 round-trips Supabase serializados** (upsert + insert + alert enqueue). Paquete con 10 registros = ~20–30 queries en un solo job.

**Fallback inline:** si Redis falla al encolar, procesamiento ocurre en proceso TCP — elimina backpressure y puede saturar el handler.

### 3.3 Base de datos

| Tabla | Crecimiento | Índices | Partición |
|-------|-------------|---------|-----------|
| `position_history` | **Dominante** (~1M filas/día @ 100 veh × 30s) | vehicle_time, company_time, composite | ✅ Mensual RANGE |
| `vehicle_positions` | 1 fila/vehículo | company_id, recorded_at | No |
| `alerts` | Event-driven | unack, company+time | No |
| `mobile_events` | Append (027) | device+time | No |
| `trips` | Estático (RPC no cableado) | — | No |
| `audit_logs` | Bajo | company, created_at | No |

**Cron activos (018, 026):**
- Offline devices cada 5 min
- Cleanup historial > 1 año (DELETE, no DROP partition)
- Crear partición mes siguiente (día 1)

**Gaps:**
- `route_history_days` por plan no aplicado en cron (siempre 1 año)
- Cleanup por DELETE → bloat de índices en particiones vacías
- Sin retención en `alerts`, `mobile_events`

### 3.4 Realtime / mapas

| Patrón | Implementación | Impacto |
|--------|----------------|---------|
| Realtime source | WAL de `vehicle_positions` upserts | 1 evento DB por posición |
| UI batching | `use-realtime.ts` flush 1 Hz | ✅ Reduce renders |
| SSR mapa/dashboard | **Todas** las posiciones sin límite | ❌ Escala O(n) flota |
| Leaflet | Marker cluster + reuse | ✅ Bueno 500+ |
| Google Maps | Sin cluster, O(n) markers | ❌ Degrada >100–200 |
| Alertas duplicate subs | AlertsFeed + ToastContainer | ⚠ 2 canales idénticos |

### 3.5 Frontend

| Página/API | Problema | Severidad |
|------------|----------|-----------|
| Dashboard SSR | `force-dynamic`, fetch all positions | Alta |
| Map SSR | Igual | Alta |
| `/api/history` | Sin paginación, max 7 días | Media |
| `/api/vehicles/[id]/track` | Hasta 8,000 puntos | Media |
| AlertsChart | Fetch 500 alertas client-side | Media |
| Supabase client | No singleton en hook | Media |
| Build | TS/ESLint ignorados | Baja (calidad) |

### 3.6 Mobile

| Aspecto | Estado |
|---------|--------|
| Intervalos | 5, 10, 30, 60, 300 s (no modos nombrados) |
| Accuracy | `BestForNavigation` fijo |
| Offline queue | AsyncStorage, flush al reconectar |
| Batería | Metadata enviada, sin perfil bajo consumo |
| Telemetría | Mismo path DB que hardware (upsert + insert) |

### 3.7 Memoria / CPU (gps-server)

| Recurso | Uso | Riesgo |
|---------|-----|--------|
| `deviceCache` / `rulesCache` | TTL, sin LRU max | Crecimiento con IMEIs |
| `Buffer.concat` | Por chunk TCP | Alloc pressure |
| Workers + TCP | Misma VM | Contención CPU |
| Supabase clients | Nuevo por job posible | Conexiones |

---

## 4. Problemas encontrados (priorizados)

### P0 — Críticos para escala >1,000 dispositivos

| ID | Problema | Impacto | Solución recomendada |
|----|----------|---------|----------------------|
| PERF-P01 | Escrituras DB serializadas por registro | Latencia worker, techo ~500–1k dev | Batch RPC `insert_positions_batch` |
| PERF-P02 | Realtime por cada upsert | WAL + fan-out clientes | Throttle upsert (solo si cambio >Xm) o cache Redis última pos |
| PERF-P03 | Geofence RPC fan-out | Postgres satura antes que TCP | Evaluar geofences en worker con cache; reducir RPCs |
| PERF-P04 | Single Fly instance | SPOF, sin scale-out TCP | Multi-instance + sticky IMEI / gateway |
| PERF-P05 | SSR sin límite posiciones | TTFB mapa/dashboard crece lineal | Paginar/limitar + hidratar vía API |

### P1 — Altos

| ID | Problema | Impacto | Solución |
|----|----------|---------|----------|
| PERF-P06 | Cleanup DELETE vs DROP partition | Bloat, vacuum costoso | DROP TABLE particiones > retention |
| PERF-P07 | Google Maps sin cluster | UI lag flotas grandes | Cluster o default Leaflet >N |
| PERF-P08 | Duplicate Realtime alert channels | 2× conexiones WS | Canal compartido / event bus |
| PERF-P09 | Inline fallback sin backpressure | Caída Redis = cascada | Circuit breaker, reject TCP |
| PERF-P10 | Command poller 3s/50 | Carga DB constante | Event-driven o backoff |

### P2 — Medios

| ID | Problema | Solución |
|----|----------|----------|
| PERF-P11 | Caches unbounded | LRU max entries |
| PERF-P12 | Buffer.concat | Buffer list prealloc |
| PERF-P13 | Alerts sin archivado | Retention cron 90d |
| PERF-P14 | mobile_events sin TTL | Cron cleanup |
| PERF-P15 | History track 8000 pts | Paginación + streaming |
| PERF-P16 | Supabase client no singleton | Module singleton |

### P3 — Bajos / deuda

| ID | Problema |
|----|----------|
| PERF-P17 | Docs ARCHITECTURE.md stale |
| PERF-P18 | trips RPC no usado |
| PERF-P19 | Sin métricas Prometheus |
| PERF-P20 | Sin load tests automatizados |

---

## 5. Puntos de saturación (orden de aparición)

```
1. Postgres writes (position_history INSERT rate)
        ↓
2. Geofence RPCs (alert worker × geofences × companies)
        ↓
3. Supabase Realtime (vehicle_positions WAL)
        ↓
4. GPS worker queue depth (Redis memory)
        ↓
5. Fly CPU (decode + 80 worker slots)
        ↓
6. Vercel SSR (all positions query)
        ↓
7. Cliente mapa (Google path, no cluster)
```

---

## 6. Tiempos de respuesta estimados (actual)

| Operación | Estimado actual | Target enterprise |
|-----------|-----------------|-------------------|
| ACK Teltonika → cola | <5 ms | <2 ms |
| Job GPS → DB persistido | 50–200 ms/registro | <20 ms/batch |
| Realtime → mapa UI | 1–2 s (batch 1 Hz) | 1 s OK |
| Dashboard SSR (500 veh) | 1–3 s | <800 ms |
| History 7 días | 2–8 s | <2 s |
| Alert geofence eval | 10–100 ms/RPC | <10 ms cached |

*Sin mediciones APM en producción — estimaciones por arquitectura.*

---

## 7. Soluciones recomendadas por fase

### Ola 1 — Quick wins (2 semanas, sin romper compat)

1. Singleton Supabase browser client
2. Consolidar suscripción alertas Realtime
3. Límite SSR posiciones (ej. 500) + lazy load resto
4. LRU en deviceCache/rulesCache
5. Google Maps → Leaflet auto si fleet >150
6. Archivar docs worker concurrency

### Ola 2 — DB throughput (4 semanas)

7. RPC batch insert positions (upsert + history en una transacción)
8. DROP partition mensual post-retention
9. Índice parcial alerts unacknowledged recientes
10. Retention cron alerts + mobile_events

### Ola 3 — Escala 1k–10k (2–3 meses)

11. Separar gps-server: TCP gateway + worker pods
12. Redis cache últimas posiciones (read path mapa)
13. Throttle Realtime upserts (delta >50m o >30s)
14. Geofence pre-filter por bounding box
15. Connection registry Redis (multi-instance TCP)

### Ola 4 — Escala 10k–100k (6–12 meses)

16. TimescaleDB / hypertable para position_history
17. Read replicas Supabase / dedicated PG
18. CDN + edge cache configs
19. K8s HPA workers
20. Load balancer TCP con session affinity IMEI

---

## 8. Compatibilidad garantizada

Todas las optimizaciones propuestas mantienen:
- Protocolo Teltonika Codec 8/8E sin cambios en dispositivo
- Schema `vehicle_positions` / `position_history` (batch = mismo resultado)
- APIs REST existentes (paginación aditiva, no breaking)
- Mobile telemetry schema
- Supabase Realtime (puede reducir frecuencia, no eliminar)

---

## 9. Referencias

- [`ARQUITECTURA_ESCALABILIDAD_TRACKPROGPS.md`](./ARQUITECTURA_ESCALABILIDAD_TRACKPROGPS.md)
- [`PLAN_CAPACIDAD_TRACKPROGPS.md`](./PLAN_CAPACIDAD_TRACKPROGPS.md)
- [`RESULTADOS_OPTIMIZACION.md`](./RESULTADOS_OPTIMIZACION.md)
- [`ANALISIS_ARQUITECTURA_TRACKPROGPS.md`](./ANALISIS_ARQUITECTURA_TRACKPROGPS.md)
- [`RIESGOS_Y_MEJORAS_TRACKPROGPS.md`](./RIESGOS_Y_MEJORAS_TRACKPROGPS.md)

---

*Auditoría Prompt 5 — Fase 1 completada.*
