# Riesgos y mejoras — TrackPro GPS

**Auditoría técnica:** 17 jun 2026  
**Alcance:** Riesgos técnicos, seguridad, deuda técnica y mejoras prioritarias.

---

## 1. Resumen de severidad

| Categoría | Críticos | Altos | Medios | Bajos |
|-----------|----------|-------|--------|-------|
| Seguridad | 0 | 3 | 5 | 4 |
| Infraestructura | 0 | 4 | 3 | 2 |
| Datos / DB | 0 | 2 | 4 | 2 |
| Código / deuda | 0 | 2 | 6 | 5 |
| Escalabilidad | 0 | 3 | 3 | 1 |

---

## 2. Riesgos técnicos

### 2.1 Infraestructura y disponibilidad

| ID | Riesgo | Severidad | Descripción | Mitigación |
|----|--------|-----------|-------------|------------|
| T-01 | Single instance gps-server | **Alta** | Fly `min_machines_running=1`; caída = sin ingesta | Health checks, alertas, plan multi-instancia con sticky TCP |
| T-02 | Mapa conexiones in-memory | **Alta** | `connections.ts` no compartido entre réplicas | Gateway TCP o Redis pub/sub para routing comandos |
| T-03 | Redis SPOF | **Media** | Sin Redis → inline processing satura CPU | Redis HA, límites concurrencia inline |
| T-04 | Supabase vendor lock | **Media** | Toda telemetría en Postgres managed | Retención tiered; TSDB a 10k+ devices |
| T-05 | Vercel cold starts | **Baja** | APIs ocasionales latencia | Edge donde aplique; warming |

### 2.2 Datos e integridad

| ID | Riesgo | Severidad | Descripción | Mitigación |
|----|--------|-----------|-------------|------------|
| T-06 | Particiones inactivas | **Alta** | Cron crear particiones comentado → inserts fallan | Activar pg_cron migración 018 |
| T-07 | Dual write GPS | **Media** | Upsert + insert por punto duplica I/O | Batch RPC, async historial |
| T-08 | Trips no operativos | **Media** | RPC existe pero no se llama; UI incompleta | Cablear o eliminar |
| T-09 | Odómetro RPC bug | **Media** | `detect_trip_event` cálculo incorrecto documentado | Fix + tests |
| T-10 | Limpieza historial DELETE | **Media** | DELETE masivo vs DROP partition | Política retención con DROP |

### 2.3 Protocolo GPS

| ID | Riesgo | Severidad | Descripción | Mitigación |
|----|--------|-----------|-------------|------------|
| T-11 | Solo Teltonika real | **Alta** | Clientes con otras marcas no funcionan | Fase 1 roadmap: decoders |
| T-12 | Comandos sin ACK | **Media** | Estado command puede quedar pending forever | Timeout + retry policy |
| T-13 | IMEI spoofing | **Media** | Cualquier IMEI registrado conecta | Whitelist + TLS opcional Teltonika |

---

## 3. Riesgos de seguridad

### 3.1 Autenticación y autorización

| ID | Riesgo | Severidad | Descripción | Mitigación |
|----|--------|-----------|-------------|------------|
| S-01 | RBAC incompleto | **Alta** | `canAccessRoute()` no en middleware | Enforce server-side en layout + API |
| S-02 | Register con service role | **Alta** | Endpoint público usa privilegios elevados | Validación estricta, rate limit, CAPTCHA |
| S-03 | RLS gaps familiar | **Media** | `miembro_familiar` puede ver más en API que RLS | Audit policies geofences/alert_rules |
| S-04 | Sin 2FA | **Media** | Cuentas admin solo password | TOTP Supabase |
| S-05 | Sesiones largas | **Baja** | Refresh token default Supabase | Política expiración empresa |

### 3.2 APIs y datos

| ID | Riesgo | Severidad | Descripción | Mitigación |
|----|--------|-----------|-------------|------------|
| S-06 | Realtime leak | **Media** | Mal RLS → posiciones cross-tenant | Tests RLS automatizados |
| S-07 | API keys en DB | **Media** | Tabla `api_keys` — rotación manual | Hash keys, scopes, audit |
| S-08 | Webhook Stripe | **Baja** | Bien implementado con signature | Mantener |
| S-09 | Logs sensibles | **Media** | IMEI/coords en logs gps-server | Redactar PII en prod |
| S-10 | `.env` en repo | **Alta** si ocurre | `.gitignore` presente; verificar history | Secret scanning CI |

### 3.3 Infra expuesta

| ID | Riesgo | Severidad | Descripción | Mitigación |
|----|--------|-----------|-------------|------------|
| S-11 | TCP :5000 público | **Media** | Superficie DDoS / flood | Rate limit IP, Fly autoscaling rules |
| S-12 | Health :3001 | **Baja** | Info máquina | Sin datos sensibles en /health |
| S-13 | Anthropic key | **Media** | AI chat consume API key | Rate limit por user, cost caps |

---

## 4. Deuda técnica

### 4.1 Crítica (resolver en Fase 0)

| Ítem | Ubicación | Impacto |
|------|-----------|---------|
| `ignoreBuildErrors: true` | `next.config.js` | Bugs en producción |
| `eslint.ignoreDuringBuilds` | `next.config.js` | Regresiones no detectadas |
| Particiones comentadas | migración 018 | Caída ingesta histórica |
| ARCHITECTURE.md desactualizado | `docs/ARCHITECTURE.md` | Confusión operativa |

### 4.2 Alta

| Ítem | Ubicación | Impacto |
|------|-----------|---------|
| TripsList desconectada | history UI | Feature a medias |
| `trip_id` en types sin DB | `packages/types` | Drift schema |
| Multi-marca UI-only | `device-models.ts` | Expectativas clientes |
| Combustible 10 L/100km fijo | `fuel-utils.ts` | Datos imprecisos |
| Cron mantenimiento comentado | 018 | Alertas no enviadas |

### 4.3 Media

| Ítem | Ubicación | Impacto |
|------|-----------|---------|
| Mobile sin API layer | `apps/mobile` | Lógica duplicada vs web |
| Muchos scripts one-off | `scripts/` | Mantenimiento |
| Migraciones `*b_fixed` | supabase/ | Historial confuso |
| Demo data mezclado | `demo-data.ts` | Riesgo en prod si mal flag |
| Tests limitados | solo `teltonika.test.ts` | Regresiones codec |

### 4.4 Baja

| Ítem | Impacto |
|------|---------|
| Duplicación map Google/Leaflet | Mantenimiento UI |
| Tipos generados .js en packages/types | Noise en git |
| PWA iOS limitaciones | UX conocida |

---

## 5. Mejoras prioritarias

### P0 — Inmediato (1–2 semanas)

| # | Mejora | Esfuerzo | Beneficio |
|---|--------|----------|-----------|
| 1 | Activar cron particiones `position_history` | 2h | Evita outage datos |
| 2 | Habilitar TypeScript check en CI | 1–3 días | Calidad releases |
| 3 | Rate limit `/api/auth/register` | 4h | Anti-abuso |
| 4 | Alertas Fly + queue depth | 1 día | Observabilidad |
| 5 | Documentar runbook incidentes gps-server | 4h | MTTR |

### P1 — Corto plazo (2–6 semanas)

| # | Mejora | Esfuerzo | Beneficio |
|---|--------|----------|-----------|
| 6 | RBAC middleware/API guards | 3–5 días | Seguridad |
| 7 | Batch insert historial GPS | 1 semana | Performance 10k |
| 8 | Combustible km/L por vehículo | 3–5 días | Producto |
| 9 | Cablear trips o deprecar | 1 semana | Coherencia producto |
| 10 | RLS audit miembro_familiar | 2 días | Seguridad tenant |
| 11 | Tests integración alert-worker | 1 semana | Confianza releases |

### P2 — Medio plazo (6–12 semanas)

| # | Mejora | Esfuerzo | Beneficio |
|---|--------|----------|-----------|
| 12 | API telemetry móvil | 2–3 semanas | Nuevo segmento |
| 13 | Segundo protocolo GPS | 3–4 semanas | Multi-marca |
| 14 | Gateway TCP sticky | 2 semanas | Escalar Fly |
| 15 | IA anomalías básicas | 3 semanas | Diferenciación |
| 16 | SSO / 2FA admin | 2 semanas | Enterprise sales |

### P3 — Largo plazo (3–12 meses)

| # | Mejora | Beneficio |
|---|--------|-----------|
| 17 | Pipeline stream + TSDB | Escala 100k+ |
| 18 | Multi-región ingest | Latencia LATAM |
| 19 | SOC2 / audit log | Enterprise |
| 20 | Marketplace integraciones | Ecosystem |

---

## 6. Análisis de escalabilidad — gaps por escala

| Escala | Estado actual | Gap principal | Mejora clave |
|--------|---------------|---------------|--------------|
| 1 000 | ✅ Viable | Particiones, tuning menor | P0 items |
| 10 000 | ⚠️ Con cambios | Dual write, Realtime fan-out | Batch + read replica |
| 100 000 | ❌ No ready | Postgres como TSDB | Stream pipeline |
| 1 000 000 | ❌ Requiere rediseño | Monolito TCP | Edge ingest global |

---

## 7. Oportunidades IA (riesgo si no se planifica)

| Oportunidad | Riesgo de no actuar | Primer paso |
|-------------|---------------------|-------------|
| Detección anomalías | Clientes piden "inteligencia" | Vista materializada paradas |
| Reportes NL | Competencia con BI | Expandir tools Claude |
| Mantenimiento predictivo | Churn post-garantía | Cron odómetro activo |
| Optimización rutas | Upsell logística | POC clustering |

**Riesgo IA:** costos API Anthropic sin límites → implementar quotas por company.

---

## 8. Checklist pre-implementación móvil

Antes de agregar rastreo móvil, verificar:

- [ ] Fase 0 completada (particiones, TS build)
- [ ] Schema `source_type` diseñado y revisado DBA
- [ ] Rate limits definidos
- [ ] Política privacidad actualizada (GPS teléfono)
- [ ] Mismo pipeline cola validado con payloads sintéticos
- [ ] No modificar `teltonika.ts`

---

## 9. Matriz riesgo × probabilidad

```
                    PROBABILIDAD
                 Baja    Media    Alta
              ┌────────┬────────┬────────┐
        Alta  │ T-05   │ T-01   │ T-06   │
              │        │ T-02   │ S-02   │
IMPACTO       ├────────┼────────┼────────┤
        Media │ S-08   │ T-07   │ S-01   │
              │        │ T-11   │ T-04   │
              ├────────┼────────┼────────┤
        Baja  │ S-12   │ S-05   │ S-09   │
              └────────┴────────┴────────┘
```

**Top 5 a atacar primero:** T-06, S-02, T-01, S-01, T-02

---

## 10. Conclusión

TrackPro GPS tiene una **base sólida para SaaS inicial** (multi-tenant, colas, Realtime, billing). Los riesgos más urgentes son **operacionales** (particiones, single instance GPS) y **de calidad** (build sin types). La seguridad es **aceptable para MVP** pero insuficiente para enterprise sin RBAC completo y 2FA.

**Recomendación del equipo de auditoría:** ejecutar **Fase 0** del plan de evolución antes de cualquier feature grande (móvil, multi-protocolo, IA avanzada).

---

*Documento de auditoría — sin cambios aplicados al sistema. Listo para recibir instrucciones de implementación.*
