# Plan de capacidad — TrackProGPS

**Versión:** 1.0 · Junio 2026  
**Metodología:** Modelado por componente + benchmarks estimados (sin load test prod aún)

---

## 1. Resumen

| Métrica | Capacidad actual estimada | Con Ola 1–2 | Target Tier 3 |
|---------|---------------------------|-------------|---------------|
| Dispositivos GPS activos | **~500–800** | **~2,000** | **~100,000** |
| Mensajes GPS / segundo | **~30–50** | **~150** | **~5,000+** |
| Posiciones / día | **~1.5M** | **~6M** | **~300M+** |
| Usuarios concurrentes mapa | **~100–200** | **~500** | **~5,000** |
| Empresas tenant | **~500** | **~1,000** | **~10,000** |
| Latencia mapa (p95) | **1–3 s** | **<1 s** | **<800 ms** |

---

## 2. Supuestos de carga

### Dispositivo GPS Teltonika típico

| Parámetro | Valor default |
|-----------|---------------|
| Intervalo reporte | 30 s (configurable 10–300s) |
| Registros por paquete | 1–10 (buffer dispositivo) |
| Bytes por paquete | ~50–500 |
| Conexión | TCP persistente |

### Mobile tracker

| Modo | Intervalo | Puntos/hora |
|------|-----------|-------------|
| 5s | Alta precisión | 720 |
| 60s | Normal | 60 |
| 300s | Bajo consumo | 12 |

### Usuario web mapa

| Acción | Frecuencia |
|--------|------------|
| Realtime updates | 1 Hz UI (batch) |
| SSR initial load | 1× por visita |
| Track overlay | 1× al seleccionar vehículo |

---

## 3. Capacidad por componente (actual)

### 3.1 Fly.io gps-server (1 VM: 2 CPU shared, 2 GB)

| Recurso | Límite teórico | Límite práctico | Bottleneck |
|---------|----------------|-----------------|------------|
| TCP connections | ~10,000 | **~2,000** | RAM + file descriptors |
| Decode + enqueue | ~200 pkt/s | **~50 pkt/s** | CPU shared |
| GPS worker jobs | 30 concurrent | **~20–30/s** sustained | DB latency |
| Alert worker | 40 concurrent | **~100–200 eval/s** | Geofence RPC |
| RAM | 2048 MB | **~1.5 GB usable** | Node heap + buffers |

**Fórmula dispositivos máx (solo TCP):**

```
devices_max ≈ (pkt/s_capacity × interval_sec) / records_per_packet
            ≈ (50 × 30) / 1 = 1,500 dispositivos @ 30s, 1 record/pkt
            ≈ 500 dispositivos @ 10s interval (más realista bajo carga mixta)
```

### 3.2 Supabase Postgres (Pro tier típico)

| Métrica | Capacidad estimada | Notas |
|---------|-------------------|-------|
| Writes/s position | **~100–300** | Upsert + insert × 2 |
| Reads/s dashboard | **~500** | Con índices actuales |
| Realtime events/s | **~200–500** | Por upsert vehicle_positions |
| Storage position_history | **~50 GB/año** @ 500 dev × 30s | ~3 KB/row |
| Connections | **~200** pooler | Workers + Vercel |

**Punto de saturación:** ~500–1,000 dispositivos @ 30s con geocercas activas (alert RPC multiplica carga).

### 3.3 Redis Upstash

| Métrica | Capacidad |
|---------|-----------|
| Enqueue/s | **~10,000** (no es bottleneck) |
| Queue depth sostenible | **~50,000** jobs |
| Memory | Depende plan; 5k+10k job retention OK |

### 3.4 Vercel (Next.js)

| Métrica | Capacidad actual | Limitante |
|---------|------------------|-----------|
| SSR dashboard 500 pos | **~2–4 s** cold | Query all positions |
| API /history 7d | **~3–10 s** | Full scan + simplify |
| Concurrent users | **~500–1000** | Vercel plan limits |
| Function duration | 10–60s max | History reports |

### 3.5 Realtime (Supabase)

| Escenario | Capacidad |
|-----------|-----------|
| 1 empresa, 500 veh, 50 users | ✅ OK con batch 1 Hz |
| 1 empresa, 2000 veh, 200 users | ⚠ Lag perceptible |
| 10 empresas × 500 veh c/u | ✅ (channels separados) |

---

## 4. Escenarios de carga simulados

### Escenario A — 100 dispositivos

| Métrica | Valor |
|---------|-------|
| msg/s | ~3.3 (@ 30s) |
| Inserts/día | ~288,000 |
| DB load | **5%** capacidad |
| Veredicto | ✅ Holgado |

### Escenario B — 1,000 dispositivos

| Métrica | Valor |
|---------|-------|
| msg/s | ~33 |
| Inserts/día | ~2.88M |
| DB load | **~40–60%** |
| Alert RPC | **Posible saturación** con muchas geocercas |
| Veredicto | ⚠ Requiere Ola 1–2 |

### Escenario C — 10,000 dispositivos

| Métrica | Valor |
|---------|-------|
| msg/s | ~333 |
| Inserts/día | ~28.8M |
| Arquitectura actual | **Colapsa** (DB + single VM) |
| Requerido | Batch RPC, multi-gateway, TimescaleDB |
| Veredicto | ❌ Rediseño Tier 2–3 |

### Escenario D — 100,000 dispositivos

| Métrica | Valor |
|---------|-------|
| msg/s | ~3,333 |
| Inserts/día | ~288M |
| Requerido | K8s, TCP LB, TimescaleDB, read replicas |
| Veredicto | ❌ Tier 3 completo |

### Escenario E — Millones de posiciones históricas

| Volumen | Storage | Query 7d | Mitigación |
|---------|---------|----------|------------|
| 100M rows | ~300 GB | OK con partition prune | Actual OK |
| 1B rows | ~3 TB | Lento sin TSDB | TimescaleDB |
| 10B rows | ~30 TB | Inviable en PG estándar | Tiered storage S3 |

---

## 5. Mejoras necesarias por umbral

| Umbral | Mejora | Esfuerzo | Impacto capacidad |
|--------|--------|----------|-------------------|
| **500 → 1,000 dev** | Batch RPC positions | 1 sem | **×3 writes** |
| | LRU caches | 1 día | Estabilidad RAM |
| | SSR position limit | 2 días | **×2 TTFB mapa** |
| **1k → 5k dev** | Worker/TCP split | 2 sem | **×5 TCP** |
| | Redis last_pos cache | 1 sem | **-70% read DB** |
| | Geofence debounce | 1 sem | **-50% alert RPC** |
| **5k → 10k dev** | 2+ TCP gateways | 3 sem | **×2–4 TCP** |
| | Realtime throttle | 1 sem | **-60% WAL** |
| | DROP partition cleanup | 2 días | Storage |
| **10k → 100k dev** | TimescaleDB | 1–2 meses | **×10 storage/query** |
| | K8s HPA workers | 1 mes | Elastic compute |
| | Read replicas | 2 sem | **×5 read** |

---

## 6. Plan de pruebas de carga (Fase 11)

### Herramientas propuestas

| Tool | Uso |
|------|-----|
| `scripts/test-gps-live.mjs` | Baseline existente |
| Simulador Teltonika (nuevo) | N conexiones TCP concurrentes |
| k6 | APIs web `/api/history`, dashboard |
| Artillery | WebSocket Realtime (opcional) |

### Matriz de pruebas

| Test ID | Dispositivos | Duración | KPIs |
|---------|--------------|----------|------|
| LT-100 | 100 | 30 min | p95 job <100ms, 0 errors |
| LT-500 | 500 | 1 h | queue depth <1000, CPU <70% |
| LT-1000 | 1,000 | 1 h | p95 persist <200ms, alert lag <5s |
| LT-5000 | 5,000 | 30 min | Identificar breaking point |
| LT-API | 200 users | 15 min | map SSR p95 <2s |
| LT-HIST | 50 concurrent | 10 min | /history p95 <5s |

### Criterios de éxito

- **0%** pérdida paquetes GPS (ACK siempre)
- Queue depth no crece indefinidamente
- p95 processing <500ms @ target load
- Realtime UI actualiza en <2s
- Sin OOM en gps-server

---

## 7. Dimensionamiento infra recomendado

### Tier 1 (hasta 1,000 dev) — actual mejorado

| Servicio | Spec |
|----------|------|
| Fly gps-server | 2 CPU dedicated, 4 GB |
| Supabase | Pro |
| Redis | Upstash 1 GB |
| Vercel | Pro |

**Costo orientativo:** $150–300 USD/mes

### Tier 2 (1k–10k dev)

| Servicio | Spec |
|----------|------|
| Fly/K8s | 2× gateway + 3× worker |
| Supabase | Pro + compute upgrade |
| Redis | Cluster 3 node |
| Vercel | Pro + edge |

**Costo orientativo:** $800–2,000 USD/mes

### Tier 3 (10k–100k dev)

| Servicio | Spec |
|----------|------|
| K8s | 5–20 worker pods HPA |
| Postgres | Dedicated + TimescaleDB |
| Redis | Cluster HA |
| TCP LB | Fly Anycast o dedicated |

**Costo orientativo:** $5,000–20,000 USD/mes

---

## 8. Monitoreo de capacidad

### Métricas clave (dashboard interno)

```
┌─────────────────────────────────────────┐
│ TrackPro Capacity Dashboard             │
├─────────────────────────────────────────┤
│ Active devices:      847 / 1,000        │
│ GPS msg/s:           28.3               │
│ Queue depth:         gps:42 alert:18    │
│ DB write latency:    p95 45ms           │
│ Realtime lag:        p95 1.2s           │
│ Fly CPU:             62%                │
│ Fly RAM:             1.4 / 2.0 GB       │
└─────────────────────────────────────────┘
```

### Alertas de capacidad

| Alerta | Umbral | Acción |
|--------|--------|--------|
| Queue depth high | >5,000 5 min | Scale workers |
| DB CPU | >80% 10 min | Upgrade compute |
| TCP connections | >80% max | Add gateway |
| Processing p95 | >500ms | Investigate batch |
| Realtime lag | >5s | Throttle upserts |

---

## 9. Roadmap capacidad (12 meses)

| Mes | Hito | Capacidad resultante |
|-----|------|---------------------|
| M1 | Ola 1 quick wins | 800 dev |
| M2 | Batch RPC + SSR limit | 2,000 dev |
| M3 | Load tests LT-500/1000 | Validado |
| M4–5 | TCP/worker split | 5,000 dev |
| M6 | Redis cache + throttle RT | 8,000 dev |
| M7–9 | TimescaleDB eval + pilot | 20,000 dev |
| M10–12 | K8s + multi-gateway | 50,000+ dev |

---

## 10. Riesgos de capacidad

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Crecimiento súbito clientes | Media | Alto | Auto-alert queue depth |
| Geofence-heavy fleet | Alta | Medio | Debounce + bbox filter |
| Mobile adoption spike | Media | Medio | Rate limit + batch |
| Supabase plan limits | Baja | Alto | Dedicated PG plan |
| Single Fly region outage | Baja | Crítico | Multi-region DR |

---

*Ver [`AUDITORIA_RENDIMIENTO_TRACKPROGPS.md`](./AUDITORIA_RENDIMIENTO_TRACKPROGPS.md) para problemas detallados y [`ARQUITECTURA_ESCALABILIDAD_TRACKPROGPS.md`](./ARQUITECTURA_ESCALABILIDAD_TRACKPROGPS.md) para diseño target.*
