# Plan de respuesta a incidentes — TrackProGPS

**Versión:** 1.0 · **Clasificación:** Interno / Clientes enterprise bajo NDA  
**Contacto seguridad:** soporte@trackprogps.mx · escalación ingeniería vía panel admin

---

## 1. Objetivo

Definir acciones ante incidentes de seguridad que afecten confidencialidad, integridad o disponibilidad de TrackProGPS, incluyendo datos GPS, usuarios, empresas y infraestructura.

---

## 2. Clasificación de incidentes

| Nivel | Descripción | Ejemplo | SLA respuesta |
|-------|-------------|---------|---------------|
| **P0 — Crítico** | Brecha activa, datos expuestos, plataforma caída | RLS bypass, DB leak, gps-server comprometido | **< 1 hora** |
| **P1 — Alto** | Intentos activos, degradación severa | Brute force masivo, DDoS GPS, cuenta admin comprometida | **< 4 horas** |
| **P2 — Medio** | Anomalía contenida, sin exfiltración confirmada | Pico login fallidos, IMEI spoofing aislado | **< 24 horas** |
| **P3 — Bajo** | Evento informativo | Scan puertos, intento XSS bloqueado | **< 72 horas** |

---

## 3. Equipo de respuesta

| Rol | Responsabilidad |
|-----|-----------------|
| **Incident Commander (IC)** | Coordinación, decisiones, comunicación |
| **Ingeniero backend** | APIs, gps-server, Supabase |
| **DevOps** | Vercel, Fly, Redis, DNS |
| **DBA / Supabase** | RLS, backups, queries forenses |
| **Comunicaciones** | Clientes afectados, legal |
| **CISO / CTO** | Aprobación comunicados externos |

---

## 4. Flujo de respuesta

```
DETECCIÓN → CLASIFICACIÓN → CONTENCIÓN → ERRADICACIÓN → RECUPERACIÓN → POST-MORTEM
```

### Fase 1 — Detección

Fuentes:
- Alertas Vercel / Fly / Supabase
- Reportes clientes / soporte
- Monitoreo login fallidos (futuro)
- Auditoría `security_events` (futuro)

**Acción inmediata:** registrar incidente con timestamp, síntomas, sistemas afectados.

---

### Fase 2 — Contención

#### Brecha de datos / acceso no autorizado

1. **Revocar** sesiones comprometidas (Supabase admin → sign out user)
2. **Rotar** secrets si expuestos: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, `ANTHROPIC_*`, API keys
3. **Desactivar** usuarios/API keys afectados
4. **Bloquear IP** en Vercel/Fly/Cloudflare si aplica
5. **Preservar evidencia:** logs Vercel, Fly, Supabase audit (no borrar)

#### Compromiso gps-server

1. Escalar a Fly: `flyctl machine stop` si necesario
2. Rotar `SUPABASE_SERVICE_ROLE_KEY` usado por worker
3. Revisar IMEIs con actividad anómala reciente
4. Redeploy imagen limpia desde CI

#### DDoS / abuso API

1. Activar rate limiting emergency (Cloudflare / Vercel firewall)
2. Throttle endpoint afectado (`register`, `telemetry`)
3. CAPTCHA temporal en registro

#### Ransomware / corrupción DB

1. **No pagar** — contactar Supabase support
2. Evaluar PITR restore a punto pre-incidente
3. Comunicar ventana de downtime

---

### Fase 3 — Erradicación

- Parchear vulnerabilidad root cause
- Deploy fix a producción
- Verificar RLS policies
- Scan dependencias (`npm audit`)
- Revisar accesos admin recientes

---

### Fase 4 — Recuperación

| Servicio | Verificación |
|----------|--------------|
| Web | Login, mapa, APIs críticas |
| GPS | Dispositivo test envía posición |
| Mobile | Registro + telemetry |
| Billing | Webhook Stripe test mode |
| Realtime | Mapa actualiza posición |

**Criterio de cierre:** 24h sin recurrencia + smoke tests OK.

---

### Fase 5 — Post-mortem

Documentar en 5 días hábiles:
- Timeline
- Root cause
- Impacto (usuarios, empresas, registros)
- Acciones tomadas
- Acciones preventivas (tickets)
- Lecciones aprendidas

Template: issue interno + resumen para clientes enterprise si aplica.

---

## 5. Comunicación

### Interna

- Canal: equipo técnico + management
- Updates P0: cada 30 min hasta contención

### Clientes afectados

**Notificar si:**
- Datos personales o ubicaciones expuestos
- Cuenta comprometida confirmada
- Downtime > 4 horas

**Contenido mínimo:**
- Qué ocurrió (sin detalles exploit)
- Datos afectados
- Medidas tomadas
- Acciones recomendadas al cliente (cambiar password)
- Contacto soporte

**Plazos legales:** revisar LFPDPPP (México) — notificación a titulares y autoridad si aplica.

### Autoridades

Consultar legal si exposición masiva datos personales / ubicación sensible.

---

## 6. Escenarios específicos

### 6.1 IMEI clonado / GPS falso

1. Identificar vehículo/IMEI en logs
2. Marcar dispositivo `offline` / desvincular temporalmente
3. Alertar empresa cliente
4. Validar segunda fuente (mobile, patrón histórico)
5. Post-incidente: reforzar pre-registro IMEI

### 6.2 Cuenta admin comprometida

1. Desactivar usuario `is_active=false`
2. Revocar todas las sesiones Supabase
3. Auditar `audit_logs` últimas 48h
4. Revisar cambios: usuarios, dispositivos, geocercas, billing
5. Forzar reset password + 2FA al rehabilitar

### 6.3 Filtración API key / service role

1. Rotar key inmediatamente en Supabase dashboard
2. Actualizar Vercel + Fly secrets
3. Redeploy ambos servicios
4. Auditar accesos con key antigua (logs Supabase si disponible)
5. Notificar si acceso externo detectado

### 6.4 Enlace compartir ubicación abusado

1. Revocar tokens en `mobile_location_shares`
2. Rate limit endpoint `/api/share/location`
3. Acortar TTL default si necesario

---

## 7. Backup y restauración

| Escenario | Procedimiento |
|-----------|---------------|
| Corrupción parcial | PITR Supabase a timestamp |
| Drop accidental tabla | PITR + contact support |
| Pérdida región Fly | Redeploy otra región (plan DR) |
| Pérdida Vercel | Redeploy desde git |

**RTO objetivo:** 4 horas (web) · 2 horas (GPS)  
**RPO objetivo:** 15 minutos (PITR Supabase)

**Prueba restore:** trimestral en staging.

---

## 8. Contactos de escalación

| Proveedor | Uso |
|-----------|-----|
| Supabase Support | DB, Auth, PITR |
| Vercel Support | Web down, env |
| Fly.io Support | GPS server |
| Stripe Support | Fraude billing |
| Resend | Email deliverability |

---

## 9. Checklist respuesta rápida (P0/P1)

- [ ] IC asignado
- [ ] Clasificación P0–P3
- [ ] Contención ejecutada
- [ ] Evidencia preservada
- [ ] Stakeholders notificados
- [ ] Fix desplegado
- [ ] Servicios verificados
- [ ] Post-mortem programado
- [ ] CHECKLIST_SEGURIDAD actualizado

---

*Revisar y simular este plan anualmente.*
