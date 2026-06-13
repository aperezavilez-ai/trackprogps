# TrackPro GPS — Guía de Arquitectura

## Visión general

TrackPro GPS es una plataforma SaaS multiempresa para rastreo vehicular. La arquitectura está diseñada para escalar de 0 a 100,000 dispositivos sin cambios fundamentales de infraestructura.

## Diagrama de flujo GPS

```
Dispositivo Teltonika
        │  TCP :5000
        ▼
┌─────────────────┐
│  GPS TCP Server │  Node.js (Railway/Fly.io)
│  - Decoder C8   │
│  - Buffer acum. │
│  - ACK + count  │
└────────┬────────┘
         │ BullMQ job
         ▼
┌─────────────────┐
│   Redis Queue   │  Upstash / Railway Redis
│  gps-positions  │
│  alert-checks   │
│  notifications  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GPS Worker     │  concurrency: 10
│  - IMEI lookup  │
│  - Upsert pos   │
│  - Insert hist  │
│  - Queue alert  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Alert Worker   │  concurrency: 20
│  - Speed check  │
│  - Geofence     │
│  - Ignition     │
│  - Insert alert │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notif Worker   │  concurrency: 5
│  → Edge Func    │
│    Email/WA/FCM │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │
│  Postgres+RT    │◄── Frontend (Next.js)
│  vehicle_pos    │         │
│  position_hist  │    WebSocket
│  alerts         │◄────────┘
└─────────────────┘
```

## Decisiones técnicas

### ¿Por qué BullMQ en lugar de procesar en el TCP server?
El servidor TCP debe ser extremadamente rápido para no bloquear la recepción de paquetes. Encolar en Redis toma ~1ms; insertar en Postgres podría tomar 20-50ms. Con 1000 dispositivos enviando cada 10s → 100 paquetes/segundo; procesar async evita bottlenecks.

### ¿Por qué Supabase Realtime en lugar de WebSockets propios?
Supabase Realtime se basa en PostgreSQL logical replication vía la extensión `wal2json`. Cualquier INSERT/UPDATE en `vehicle_positions` es automáticamente publicado a los clientes suscritos. Cero infraestructura extra, horizontal scaling gratis.

### ¿Por qué table partitioning en position_history?
`position_history` crece ~1M filas/día con 100 vehículos activos enviando cada 30s (100 × 2880). En 1 año → ~365M filas. Sin particionamiento, los queries por rango de fechas escanearían toda la tabla. Con particiones mensuales, Postgres solo lee la(s) partición(es) relevante(s).

### ¿Por qué soft delete en vehicles/drivers?
Los registros históricos (posiciones, alertas, mantenimiento) referencian vehicles y drivers. Eliminar físicamente rompería la integridad referencial o requeriría CASCADE que destruiría el historial. Con `deleted_at`, el registro queda invisible en la UI pero el historial se mantiene íntegro.

### ¿Por qué Douglas-Peucker en el historial de rutas?
Un vehículo circulando 8 horas a 30s de intervalo genera ~960 puntos. En ruta larga esto puede ser 10,000+ puntos. El algoritmo DP reduce puntos colineales preservando la forma de la ruta. Resultado: 10,000 → ~300-500 puntos sin pérdida visual perceptible. Performance del mapa mejora 20x.

### ¿Por qué PostGIS para geocercas en lugar de cálculo en Node?
PostGIS procesa millones de puntos/segundo en el servidor. Si se hiciera en Node, habría que traer toda la geometría a memoria para cada update de posición. Con PostGIS, la función `is_inside_geofence()` corre en microsegundos directamente en Postgres, sin round-trip.

## Modelo multiempresa

Toda tabla tiene `company_id`. Las políticas RLS de Supabase filtran automáticamente en cada query. El helper `auth.company_id()` extrae el company_id del usuario autenticado. No hay esquemas separados por tenant — un solo esquema es más fácil de mantener y los índices por company_id son suficientemente eficientes hasta ~1000 empresas.

Cuando una empresa supera ~10,000 vehículos o ~10M posiciones/mes, migrar a TimescaleDB (extensión de Postgres) para `position_history` añade compresión automática (90% menos espacio) y chunk-based queries.

## Flujo de autenticación

1. Usuario hace login → Supabase Auth genera JWT
2. JWT contiene `sub` (user_id) — no el company_id
3. `auth.company_id()` hace lookup en tabla `users` usando `auth.uid()`
4. Todas las RLS policies usan `auth.company_id()` para filtrar
5. Service role key (solo backend/workers) bypasea RLS

## Escalabilidad

| Métrica         | Tier 1       | Tier 2         | Tier 3          |
|-----------------|-------------|----------------|-----------------|
| Empresas        | 1-100       | 100-1000       | 1000+           |
| Vehículos       | 1-1000      | 1000-10000     | 10000-100000    |
| GPS msg/s       | 1-100       | 100-1000       | 1000-10000      |
| GPS Server      | 1 instancia | 2-4 instancias | K8s HPA         |
| Redis           | Single      | Cluster        | Cluster sharded |
| Postgres        | Supabase Pro| Supabase Pro+  | Dedicated PG    |
| Workers         | 3 workers   | 10+ workers    | K8s pods        |

## Seguridad

- RLS: cada empresa solo ve sus datos
- API keys hasheadas (SHA-256) — nunca texto plano en DB
- Webhook Stripe verificado con firma HMAC
- Service role key solo en variables de entorno del servidor
- Anon key pública (solo lectura según RLS)
- Middleware verifica sesión en cada request del dashboard

## Monitoreo recomendado

- **Uptime Kuma** o **Betterstack** para GPS Server health endpoint
- **Sentry** para errores en Next.js y workers
- **Bull Board** en desarrollo (puerto 3002) para monitorear colas
- **Supabase Dashboard** para queries lentas y uso de DB
- **Axiom** o **Datadog** para logs de workers
