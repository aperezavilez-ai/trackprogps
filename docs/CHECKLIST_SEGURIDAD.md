# Checklist de seguridad — TrackProGPS

**Versión:** 1.0 · Junio 2026  
**Uso:** Pre-deploy, auditoría trimestral, onboarding enterprise

**Leyenda:** ✅ Cumple · ⚠ Parcial · ❌ Pendiente · N/A No aplica

---

## FASE 1 — Auditoría arquitectura

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 1.1 | Diagrama arquitectura documentado | ✅ | `ENTERPRISE_ARQUITECTURA_FINAL.md` |
| 1.2 | Flujos de datos identificados | ✅ | `MAPA_SISTEMA_TRACKPROGPS.md` |
| 1.3 | Superficie de ataque inventariada | ✅ | `SEGURIDAD_TRACKPROGPS.md` §2 |
| 1.4 | Dependencias third-party listadas | ✅ | Vercel, Fly, Supabase, Stripe, etc. |
| 1.5 | Threat model actualizado | ⚠ | Enterprise docs; formal STRIDE pendiente |

---

## FASE 2 — Autenticación y usuarios

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 2.1 | Login Supabase email/password | ✅ | |
| 2.2 | Email confirmation obligatorio | ✅ | dashboard layout |
| 2.3 | Password mínimo 8 caracteres | ✅ | register schema |
| 2.4 | JWT refresh automático (middleware) | ✅ | `middleware.ts` |
| 2.5 | Expiración sesión configurable | ❌ | Supabase defaults |
| 2.6 | 2FA / MFA | ❌ | Roadmap Ola 2 |
| 2.7 | Cierre remoto sesión web | ❌ | Mobile sí (`mobile_sessions`) |
| 2.8 | Detección login sospechoso | ❌ | |
| 2.9 | RBAC 6 roles definidos | ✅ | `permissions.ts` |
| 2.10 | RBAC enforced middleware | ❌ | Solo nav + API parcial |
| 2.11 | Permisos personalizados | ❌ | Roadmap |
| 2.12 | Cuentas inactivas bloqueadas | ✅ | `is_active`, layout redirect |

---

## FASE 3 — Seguridad API

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 3.1 | Auth en rutas privadas | ⚠ | Mayoría sí; auditar todas |
| 3.2 | Validación Zod inputs | ⚠ | ~90% rutas |
| 3.3 | Rate limiting global | ❌ | Solo support 5min/email |
| 3.4 | Rate limit register/login | ❌ | **P0** |
| 3.5 | Rate limit mobile telemetry | ❌ | |
| 3.6 | API keys hashed (SHA256) | ✅ | schema |
| 3.7 | API keys UI rotación | ❌ | |
| 3.8 | API pública v1 documentada | ⚠ | Spec only |
| 3.9 | Audit log llamadas API | ❌ | |
| 3.10 | Stripe webhook signature | ✅ | |
| 3.11 | Sanitización search ilike | ❌ | vehicles, drivers, AI |
| 3.12 | Error messages sin stack trace prod | ✅ | Vercel default |
| 3.13 | CORS restringido | ✅ | Same-origin API |
| 3.14 | CSRF mitigado (SameSite cookies) | ⚠ | Supabase SSR |

---

## FASE 4 — Protección de datos

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 4.1 | TLS en web/API | ✅ | Vercel |
| 4.2 | Encryption at rest DB | ✅ | Supabase |
| 4.3 | RLS multi-tenant | ✅ | |
| 4.4 | Service role solo server-side | ✅ | |
| 4.5 | PII en logs minimizada | ❌ | GPS logs IMEI |
| 4.6 | Principio mínimo privilegio DB | ⚠ | Revisar policies |
| 4.7 | Retención historial 1 año | ✅ | cron cleanup |
| 4.8 | Export datos controlado por rol | ⚠ | reports API |
| 4.9 | Share location token hashed | ✅ | SHA256 |
| 4.10 | Secrets fuera de git | ✅ | `.gitignore` |

---

## FASE 5 — Auditoría y trazabilidad

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 5.1 | Tabla `audit_logs` | ✅ | |
| 5.2 | Log login/logout | ❌ | |
| 5.3 | Log cambios permisos | ❌ | |
| 5.4 | Log CRUD usuarios | ⚠ | parcial invite/delete |
| 5.5 | Log cambios dispositivos | ⚠ | vehicle.create |
| 5.6 | Log config empresa | ❌ | |
| 5.7 | Panel auditoría admin | ❌ | Roadmap |
| 5.8 | `security_events` table | ❌ | Spec enterprise |

---

## FASE 6 — Seguridad GPS

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 6.1 | IMEI pre-registro antes ingesta | ⚠ | Unknown IMEI skipped log |
| 6.2 | Protección buffer overflow | ✅ | 64KB limit |
| 6.3 | TLS GPS | N/A | Protocolo Teltonika |
| 6.4 | Anti replay packets | ❌ | |
| 6.5 | Detección IMEI spoofing | ❌ | Alert only |
| 6.6 | Comandos remotos RBAC | ✅ | API + roles |
| 6.7 | DDoS TCP mitigation | ❌ | |
| 6.8 | Anomalía velocidad/ubicación | ⚠ | alert_rules |

---

## FASE 7 — Seguridad mobile

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 7.1 | Auth JWT Bearer | ✅ | |
| 7.2 | Sesión revocable remoto | ✅ | |
| 7.3 | Permisos ubicación OS | ✅ | |
| 7.4 | Detección mock location | ⚠ | Alerta, no block |
| 7.5 | Detección root/jailbreak | ❌ | |
| 7.6 | Secure storage tokens | ❌ | AsyncStorage |
| 7.7 | Certificate pinning | ❌ | |
| 7.8 | Offline queue encrypted | ❌ | AsyncStorage plain |
| 7.9 | App attestation (Play/App Store) | ⚠ | EAS build |

---

## FASE 8 — Base de datos

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 8.1 | RLS todas tablas tenant | ✅ | |
| 8.2 | Índices performance sin overexpose | ✅ | |
| 8.3 | Backups automáticos | ✅ | Supabase |
| 8.4 | PITR habilitado | ⚠ | Verificar plan Supabase |
| 8.5 | Restore test trimestral | ❌ | Procedimiento en IR plan |
| 8.6 | Migraciones versionadas | ✅ | `supabase/migrations/` |
| 8.7 | Sin credenciales en SQL | ✅ | |
| 8.8 | Connection pooler | ✅ | Supavisor |

---

## FASE 9 — Infraestructura

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 9.1 | HTTPS forzado web | ✅ | |
| 9.2 | Fly health HTTPS | ✅ | force_https |
| 9.3 | Security headers (CSP, XFO) | ❌ | |
| 9.4 | `poweredByHeader` off | ✅ | |
| 9.5 | Env secrets Vercel/Fly | ✅ | |
| 9.6 | WAF / DDoS protection | ⚠ | Vercel basic |
| 9.7 | Firewall TCP GPS mínimo | ❌ | Puerto 5000 público |
| 9.8 | Dependency audit CI | ❌ | |
| 9.9 | TypeScript check CI | ❌ | ignoreBuildErrors |

---

## FASE 10 — Backup y DR

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 10.1 | Estrategia backup documentada | ✅ | IR plan §7 |
| 10.2 | RTO/RPO definidos | ✅ | 4h / 15min |
| 10.3 | Restore test ejecutado | ❌ | |
| 10.4 | Runbook gps-server caída | ✅ | IR plan |
| 10.5 | Runbook Supabase PITR | ✅ | IR plan |

---

## FASE 11 — Monitoreo seguridad

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 11.1 | Uptime monitoring web | ⚠ | Vercel |
| 11.2 | GPS health check | ✅ | :3001/health |
| 11.3 | Alertas login fallidos | ❌ | |
| 11.4 | Alertas queue depth | ❌ | |
| 11.5 | SIEM centralizado | ❌ | |
| 11.6 | On-call rotation | ⚠ | Manual |

---

## FASE 12 — Pruebas de seguridad

| # | Validación | Estado | Notas |
|---|------------|--------|-------|
| 12.1 | SQL injection — APIs search | ⚠ | Revisar manual |
| 12.2 | XSS — formularios | ✅ | React default |
| 12.3 | CSRF — mutaciones web | ⚠ | SameSite |
| 12.4 | Brute force login | ❌ | Sin lockout |
| 12.5 | Session hijacking | ⚠ | HTTPS + httpOnly cookies |
| 12.6 | IDOR vehículos/dispositivos | ⚠ | RLS primary defense |
| 12.7 | Auth bypass API | ⚠ | Test manual recomendado |
| 12.8 | Mobile MASVS L1 | ❌ | |
| 12.9 | Load test abuse endpoints | ❌ | |
| 12.10 | Pen test externo | ❌ | Anual recomendado |

---

## Resumen cumplimiento

| Fase | ✅ | ⚠ | ❌ | Total |
|------|----|----|-----|-------|
| 1 Auditoría | 4 | 1 | 0 | 5 |
| 2 Auth | 6 | 0 | 6 | 12 |
| 3 API | 4 | 5 | 5 | 14 |
| 4 Datos | 6 | 3 | 1 | 10 |
| 5 Auditoría | 1 | 2 | 5 | 8 |
| 6 GPS | 3 | 2 | 3 | 8 |
| 7 Mobile | 3 | 2 | 4 | 9 |
| 8 DB | 7 | 1 | 1 | 9 |
| 9 Infra | 5 | 1 | 3 | 9 |
| 10 DR | 4 | 0 | 1 | 5 |
| 11 Monitor | 1 | 2 | 3 | 6 |
| 12 Pruebas | 1 | 5 | 4 | 10 |
| **TOTAL** | **45** | **24** | **36** | **105** |

**Cumplimiento global:** ~43% ✅ · ~23% ⚠ · ~34% ❌

---

## Prioridad remediación (Top 10)

1. ❌ Rate limit register + login
2. ❌ RBAC middleware
3. ❌ Sanitizar ilike search
4. ❌ Security headers CSP
5. ❌ 2FA admins
6. ❌ Panel auditoría / security_events
7. ❌ Rate limit mobile telemetry
8. ❌ Rechazar mock GPS (configurable)
9. ❌ TypeScript CI gate
10. ❌ Restore test trimestral

---

## Sign-off pre-producción enterprise

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| CISO / CTO | | | |
| DevOps | | | |
| DBA | | | |
| QA Security | | | |

---

*Actualizar checklist tras cada ola de hardening. Ver [`SEGURIDAD_TRACKPROGPS.md`](./SEGURIDAD_TRACKPROGPS.md).*
