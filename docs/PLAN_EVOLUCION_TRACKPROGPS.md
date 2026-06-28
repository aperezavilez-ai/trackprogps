# Plan de evolución — TrackPro GPS

**Objetivo:** Roadmap para convertir TrackPro GPS en una plataforma empresarial completa.  
**Estado:** Post-auditoría — **no iniciar implementación** hasta instrucción explícita.

---

## 1. Visión de plataforma (12–24 meses)

TrackPro GPS evoluciona de **SaaS de rastreo Teltonika** a **plataforma unificada de movilidad**:

- Rastreo GPS físico (multi-protocolo)
- Rastreo móvil (smartphones como unidades)
- IoT y telemetría extendida
- IA operativa y predictiva
- Automatización de flotas
- Seguridad enterprise
- Escala 10k–100k dispositivos

---

## 2. Fases del roadmap

### Fase 0 — Estabilización (0–6 semanas)

**Meta:** Eliminar riesgos de producción antes de nuevas features.

| Ítem | Entregable |
|------|------------|
| Particiones | Activar cron creación `position_history_YYYY_MM` |
| Trips | Cablear `detect_trip_event` o deprecar código |
| Build quality | Type-check + ESLint en CI; quitar ignore en next.config |
| RBAC | Middleware o guard API uniforme |
| RLS audit | Alinear `miembro_familiar` en geocercas/alert_rules |
| Observabilidad | Métricas gps-server (conexiones, queue depth, lag) |
| Combustible v2 | Rendimiento km/L por vehículo (propuesta acordada) |

**Criterio de salida:** 0 errores TS en build, particiones automáticas, documentación al día.

---

### Fase 1 — Rastreo GPS físico robusto (6–12 semanas)

**Meta:** Multi-marca real y comandos confiables.

| Ítem | Descripción |
|------|-------------|
| Abstracción protocolo | Interface `GpsDecoder` + registry por `device_model` |
| Segundo codec | Queclink o Concox (prioridad según clientes) |
| Gateway TCP | Evaluar proxy sticky antes de 2+ instancias Fly |
| Batch historial | RPC bulk insert o COPY para reducir carga Postgres |
| Comandos | ACK tracking, timeout, retry en `device_commands` |
| Health | Dashboard ops: dispositivos online, lag colas |

**Criterio de salida:** ≥2 protocolos en producción, P99 ingest <2s bajo carga 500 msg/s.

---

### Fase 2 — Rastreo móvil (8–10 semanas)

**Meta:** Smartphones como dispositivos GPS sin afectar Teltonika.

```
┌─────────────┐     HTTPS      ┌──────────────┐
│ Expo / RN   │ ─────────────► │ /api/mobile/ │
│ background  │   JWT + batch  │  telemetry   │
│ location    │                └──────┬───────┘
└─────────────┘                       │
                                      ▼
                              gps-positions queue
                              (payload normalizado)
```

| Ítem | Descripción |
|------|-------------|
| Schema | `gps_devices.source_type`: `teltonika` \| `mobile_app` |
| Registro dispositivo | Vincular teléfono a vehículo o usuario |
| API ingest | POST posiciones con rate limit, validación geo |
| App mobile | Background location, batería optimizada |
| Privacidad | Consentimiento explícito, horarios tracking |
| UI | Mismo mapa/historial; badge origen móvil vs hardware |

**Principio:** Zero changes en `teltonika.ts`; solo nuevo adapter de entrada.

**Criterio de salida:** Piloto 50 unidades móviles en paralelo con hardware GPS.

---

### Fase 3 — IoT y telemetría extendida (10–14 semanas)

| Ítem | Descripción |
|------|-------------|
| Sensores | Temperatura, puertas, CAN bus vía IO Teltonika |
| Eventos custom | Tabla `telemetry_events` además de posiciones |
| Webhooks salientes | Clientes enterprise reciben eventos |
| Mantenimiento | Activar cron licencias/odómetro; alertas predictivas básicas |
| OBD / BLE | Evaluación partners hardware |

---

### Fase 4 — Inteligencia artificial (12–16 semanas)

| Caso de uso | Implementación sugerida |
|-------------|-------------------------|
| Asistente flota | Expandir `/api/ai/chat` con más tools + memoria sesión |
| Reportes NL | "Km por unidad la semana pasada" → SQL generado + validación |
| Detección anomalías | Modelo desvío ruta, exceso paradas, uso fuera de horario |
| Predicción combustible | ML sobre historial + rendimiento declarado |
| Análisis rutas | Clustering paradas, sugerencia optimización |
| Mantenimiento predictivo | Regresión sobre km, horas motor, alertas proactivas |

**Arquitectura IA:**
```
Eventos / historial ──► Feature store (vistas materializadas)
                              │
                              ▼
                    Jobs batch (Edge / worker)
                              │
                              ▼
                    API insights + UI widgets
```

**Principio:** IA como capa de lectura; nunca bloquear hot path GPS.

---

### Fase 5 — Automatización (8 semanas)

| Ítem | Descripción |
|------|-------------|
| Playbooks | Si alerta X → comando Y + notificar Z |
| Geocercas dinámicas | Horarios, reglas compuestas |
| Integraciones | Slack, Teams, webhooks |
| Onboarding | Flujo self-service empresa + activación dispositivos |
| CFDI / facturación MX | Completar integración fiscal live |

---

### Fase 6 — Seguridad enterprise (continuo)

| Ítem | Descripción |
|------|-------------|
| SSO | SAML/OIDC para empresas grandes |
| 2FA | TOTP Supabase |
| Audit log | Tabla append-only acciones admin |
| API keys | Rotación, scopes, rate limits |
| Pen test | Anual + dependency scanning |
| SOC2 prep | Logging, retención, backups documentados |

---

### Fase 7 — Escalabilidad (según crecimiento)

| Umbral | Acciones |
|--------|----------|
| 1k devices | Tuning actual: índices, pooler, batch inserts |
| 10k | 2+ gps-server con sticky TCP; read replicas; reducir Realtime payload |
| 100k | Pipeline stream (Kafka/Redpanda) → TSDB (Timescale/ClickHouse) + Postgres metadata |
| 1M | Sharding por región; edge ingest; CDN map tiles propios |

---

## 3. Matriz de priorización (impacto vs esfuerzo)

| Iniciativa | Impacto | Esfuerzo | Prioridad |
|------------|---------|----------|-----------|
| Estabilización Fase 0 | Alto | Bajo | **P0** |
| Combustible km/L | Medio | Bajo | **P0** |
| Rastreo móvil | Alto | Medio | **P1** |
| Batch historial | Alto | Medio | **P1** |
| Multi-protocolo GPS | Alto | Alto | **P1** |
| IA anomalías | Medio | Medio | **P2** |
| SSO enterprise | Medio | Alto | **P2** |
| Pipeline 100k | Alto | Muy alto | **P3** (cuando MRR lo justifique) |

---

## 4. Organización sugerida de equipos

| Squad | Responsabilidad |
|-------|-----------------|
| Ingesta & GPS | gps-server, protocolos, Fly |
| Plataforma | Supabase, migraciones, RLS |
| Producto web | Next.js, mapas, reportes |
| Mobile | Expo, telemetría móvil |
| Growth & Billing | Stripe, onboarding, legal |
| Data & IA | Analytics, ML, asistente |

---

## 5. Métricas de éxito (KPIs técnicos)

| Métrica | Target Fase 1 | Target Fase 2 |
|---------|---------------|---------------|
| Uptime gps-server | 99.9% | 99.95% |
| Lag posición → mapa | <3s P95 | <2s P95 |
| Dispositivos concurrentes | 2 000 | 5 000 |
| Errores build TS | 0 | 0 |
| Cobertura tests codec | 80% | 90% |

---

## 6. Dependencias externas a contratar/evaluar

- **Sticky load balancer** TCP (Fly proxy, HAProxy, o gateway dedicado)
- **Timescale/ClickHouse** (Fase 7)
- **Feature flags** (LaunchDarkly o similar) para rollout móvil
- **Status page** (Better Uptime, etc.)

---

## 7. Qué NO hacer en las primeras fases

- Reescribir todo en microservicios
- Migrar fuera de Supabase prematuramente
- Mezclar lógica móvil dentro del decoder Teltonika
- Desplegar IA en hot path de ingesta
- Ignorar Fase 0 por presión de features

---

## 8. Próximo paso recomendado

Tras aprobación del usuario:

1. **Fase 0** — particiones + type-check + combustible km/L  
2. **Fase 2 piloto** — API telemetry móvil + schema `source_type`  
3. Paralelo: observabilidad gps-server

---

*Roadmap vivo — revisar trimestralmente según tracción comercial y carga real de dispositivos.*
