# TrackProGPS — Plan de mantenimiento

---

## 1. Mantenimiento rutinario

### Diario (automático)

| Tarea | Mecanismo |
|-------|-----------|
| Marcar dispositivos offline | pg_cron 5 min |
| Crear partición historial | pg_cron mensual |
| Limpiar historial >1 año | pg_cron semanal |

### Semanal (operaciones)

- [ ] Revisar alertas Fly/Vercel
- [ ] Verificar queue depth Redis (Upstash)
- [ ] Revisar tickets soporte abiertos
- [ ] Monitor costos Anthropic (IA)

### Mensual

- [ ] Revisar índices Postgres (slow queries Supabase)
- [ ] Rotar/revisar secrets críticos
- [ ] Actualizar dependencias patch (npm audit)
- [ ] Backup restore test (Supabase PITR)
- [ ] Revisar capacidad dispositivos vs plan Fly

### Trimestral

- [ ] Review arquitectura vs roadmap
- [ ] Pen test básico / dependency scan
- [ ] Actualizar documentación enterprise
- [ ] Evaluar necesidad read replica / TSDB

---

## 2. Mantenimiento por componente

### Postgres

- VACUUM particiones antiguas antes de DROP
- REINDEX si bloat >20% en `position_history`
- Monitorear tamaño partición default (alerta si crece)

### GPS Server

- Log rotate Fly
- Verificar conexiones TCP activas vs capacidad
- Test decoder Teltonika tras cambios (`npm run test:gps`)

### Web

- Vercel analytics — errores 5xx
- Lighthouse performance dashboard
- Revisar `ignoreBuildErrors` — objetivo eliminar

### Mobile

- Test EAS build tras cambios nativos
- Verificar permisos iOS/Android en stores

---

## 3. Incidentes — runbook

| Síntoma | Diagnóstico | Acción |
|---------|-------------|--------|
| Mapa congelado | Realtime / gps-server | Fly logs, Redis status |
| Sin historial nuevo | Partición faltante | `create_monthly_partition(now)` |
| Mobile no reporta | API 401/403 | Sesión revocada, permisos |
| IA no responde | Anthropic quota | Verificar API key, límites plan |
| Stripe webhooks fail | Vercel logs | Reconciliar manual subscriptions |

---

## 4. Deuda técnica priorizada

Ver [`RIESGOS_Y_MEJORAS_TRACKPROGPS.md`](./RIESGOS_Y_MEJORAS_TRACKPROGPS.md).

P0 mantenimiento:
1. Type-check en CI
2. Particiones automáticas activas ✓
3. RBAC middleware
4. Observabilidad queue depth

---

## 5. SLA objetivo (enterprise)

| Métrica | Target |
|---------|--------|
| Web uptime | 99.9% |
| GPS ingest uptime | 99.9% |
| Mapa lag P95 | <5s |
| Soporte crítico | <4h respuesta |

---

## 6. Contactos y escalación

| Nivel | Responsable |
|-------|-------------|
| L1 | Soporte cliente / admin empresa |
| L2 | Equipo TrackPro (tickets `/admin/support`) |
| L3 | Ingeniería — Fly/Vercel/Supabase vendor |

---

*Plan mantenimiento v1.0 — revisar trimestralmente.*
