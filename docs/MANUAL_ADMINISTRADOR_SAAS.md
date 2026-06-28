# Manual administrador SaaS — TrackProGPS

**Versión:** 1.0 · Junio 2026  
**Audiencia:** super_admin, admin_empresa, partner_admin (futuro)

---

## 1. Introducción

Este manual describe cómo **administrar TrackProGPS como plataforma SaaS**: empresas clientes, usuarios, planes, billing, soporte y operaciones de plataforma.

**URL producción:** [https://trackprogps.mx](https://trackprogps.mx)

---

## 2. Roles y accesos

| Rol | Panel | Capacidades |
|-----|-------|-------------|
| **super_admin** | `/admin` completo | Todas las empresas, MRR, suspender, cambiar plan |
| **admin_empresa** | Dashboard tenant + `/admin/users` | Su empresa: usuarios, billing, config |
| **supervisor** | Dashboard operativo | Flota, alertas, reportes — sin billing |
| **operador** | Mapa, vehículos | Operación diaria |
| **cliente_consulta** | Solo lectura | Mapa, reportes limitados |

**Equipo plataforma:** usuarios con `company_id` = empresa interna (`interno@trackprogps.mx`, flag `platform_internal`).

---

## 3. Panel super_admin (`/admin`)

### 3.1 Acceso

1. Login con cuenta `super_admin`
2. Navegar a **Admin** en sidebar o `/admin`
3. `admin_empresa` de clientes **no** ve lista empresas — solo `/admin/users` de su tenant

### 3.2 Vista empresas

Muestra:
- Nombre empresa, email, plan, status
- Conteo vehículos / usuarios
- Enlace a billing y acciones

### 3.3 Acciones sobre empresa (API)

`POST /api/admin/companies/{id}` body `{ "action": "..." }`:

| Acción | Efecto |
|--------|--------|
| `suspend` | `status: suspended` — usuario redirige a `/suspended` |
| `activate` | `status: active` — restaura acceso |
| `cancel` | `status: cancelled` — fin servicio |
| `change_plan` | `{ "action": "change_plan", "plan_id": "uuid" }` |

**Cuándo suspender:** impago prolongado, abuso, solicitud legal.

### 3.4 Métricas plataforma

`GET /api/billing/platform-stats` (super_admin):
- MRR estimado
- Empresas pagando vs demo
- Desglose por plan

---

## 4. Gestión de usuarios

### 4.1 Usuarios plataforma (`/admin/users?scope=platform`)

- Equipo TrackProGPS (soporte, ventas, ingeniería)
- Roles: super_admin, admin_empresa, supervisor
- Empresa: interna plataforma

### 4.2 Usuarios tenant (`/admin/users`)

- admin_empresa gestiona staff de su empresa
- Invitar: Settings → Usuarios → Invitar email
- Roles disponibles: admin_empresa, supervisor, operador, cliente_consulta, miembro_familiar

### 4.3 Desactivar usuario

- Marcar `is_active: false` — no puede login (layout redirect)

### 4.4 Acceso por flotilla (vehicle_groups)

1. Crear grupo en Vehículos → Grupos
2. Asignar vehículos al grupo
3. Admin → Usuarios → Asignar acceso a grupo
4. Usuario solo ve vehículos de sus grupos (RLS)

---

## 5. Planes y límites

Ver [`SISTEMA_PLANES_TRACKPROGPS.md`](./SISTEMA_PLANES_TRACKPROGPS.md).

### 5.1 Ver consumo tenant

- Banner amarillo/rojo en dashboard si ≥80% vehículos
- RPC `get_company_usage(company_id)` vía hook `useCompanyUsage`

### 5.2 Cambiar plan manualmente

1. super_admin → API o (futuro UI) admin company
2. `change_plan` con nuevo `plan_id`
3. Verificar que tenant no excede nuevos límites

### 5.3 Downgrade con exceso

Si tenant tiene 40 vehículos y downgrade a Básico (10):
- **Opción A:** bloquear downgrade hasta reducir flota
- **Opción B:** grace 30 días (política comercial)

---

## 6. Facturación

### 6.1 Flujo cliente (self-service)

1. Cliente → **Facturación** (`/billing`)
2. Tab Suscripción → Elegir plan → Stripe Checkout
3. Tras pago: status `active`, acceso completo
4. Portal Stripe: cambiar tarjeta, cancelar

### 6.2 Estados billing

| Estado company | Estado subscription | UX |
|----------------|---------------------|-----|
| demo | cancelled | DemoGate → billing |
| active | active | Acceso completo |
| active | past_due | Warning + email |
| suspended | any | `/suspended` |
| cancelled | cancelled | Login blocked / readonly |

### 6.3 CFDI (México)

Settings → Facturación CFDI:
- RFC, razón social, régimen, uso CFDI
- **Nota:** timbrado automático pendiente; datos se guardan para futuro PAC

### 6.4 Pagos fallidos

- Webhook Stripe → email automático
- Tras X días: considerar `suspend` manual

---

## 7. Onboarding cliente nuevo

### 7.1 Self-registration

1. Cliente registra en `/register`
2. Confirma email
3. Explora demo dashboard
4. Contrata plan en billing

### 7.2 Onboarding flota (admin_empresa)

**API clients/onboard** o wizard UI:
1. Datos conductor/cliente
2. Registrar dispositivo GPS (IMEI único)
3. Crear vehículo
4. Asignar geocercas opcionales
5. Audit log `client.onboard`

### 7.3 Checklist go-live

- [ ] Plan activo o demo
- [ ] Al menos 1 vehículo + dispositivo
- [ ] IMEI conectando a gps-server (Fly :5000)
- [ ] Posición visible en mapa
- [ ] Reglas alerta configuradas
- [ ] Usuarios operadores invitados
- [ ] Mobile registrado (si plan Profesional+)

---

## 8. Soporte

### 8.1 Mesa interna (`/admin/support`)

Acceso: super_admin + equipo plataforma (admin_empresa/supervisor interno).

- Tickets con status: nuevo, en_proceso, resuelto
- Badge count en sidebar

### 8.2 Contacto público

- `/api/support/contact` — honeypot + rate limit 1/5min

---

## 9. Seguridad y auditoría

### 9.1 Aislamiento tenant

- Cada empresa solo ve sus datos (RLS)
- super_admin bypass — usar con responsabilidad

### 9.2 Audit logs

Registrados parcialmente:
- Creación vehículo
- Onboarding cliente
- Acciones admin company

**Consulta:** `audit_logs` filtrado por `company_id`.

### 9.3 Buenas prácticas admin

- No compartir service role key
- Rotar accesos super_admin periódicamente
- Documentar acciones suspend/change_plan
- Revisar [`SEGURIDAD_TRACKPROGPS.md`](./SEGURIDAD_TRACKPROGPS.md)

---

## 10. White label (admin partner — futuro)

Ver [`WHITE_LABEL_TRACKPROGPS.md`](./WHITE_LABEL_TRACKPROGPS.md).

Pasos target:
1. Verificar plan Empresarial + white_label
2. Settings → Branding → logo, colores
3. Configurar DNS CNAME
4. Verificar dominio
5. Probar login en dominio custom

---

## 11. API y integraciones (admin)

Ver [`API_COMERCIAL_TRACKPROGPS.md`](./API_COMERCIAL_TRACKPROGPS.md).

Pasos target:
1. Verificar plan `api_access`
2. Settings → API Keys → Crear
3. Copiar key (solo se muestra una vez)
4. Configurar webhooks si aplica
5. Monitorear uso en dashboard consumo

---

## 12. Operaciones GPS

### 12.1 Verificar ingesta

- Dispositivo envía a TCP `trackpro-gps-server.fly.dev:5000`
- IMEI debe estar pre-registrado en `/devices`
- `gps_devices.last_seen` actualiza; status `online`

### 12.2 Comandos remotos

- Device detail → Comandos
- Solo roles supervisor+
- Estado: pending → sent → ack / failed

### 12.3 Mobile tracking

- Tab **Móviles** en dashboard
- App Expo: registro dispositivo + tracking background
- Plan Profesional+ (`mobile_app: true`)

---

## 13. Troubleshooting SaaS

| Problema | Causa probable | Acción |
|----------|----------------|--------|
| Cliente no entra dashboard | Email no confirmado | Reenviar confirmación |
| DemoGate loop | Sin plan, demo expirado | Checkout o change_plan |
| 402 crear vehículo | Límite plan | Upgrade |
| Mapa vacío | Sin posiciones / RLS | Verificar device online |
| Pago OK pero inactive | Webhook falló | Revisar Stripe webhook logs |
| super_admin no ve empresa | Filtro status | Verificar companies.status |

---

## 14. Despliegue y entorno

| Servicio | Comando / URL |
|----------|---------------|
| Web | `vercel --prod` desde `apps/web` |
| GPS server | `npm run deploy:gps -- --deploy-only` |
| Migraciones | `node scripts/run-migrations.mjs` |

Ver [`ENTERPRISE_GUIA_DESPLIEGUE.md`](./ENTERPRISE_GUIA_DESPLIEGUE.md).

---

## 15. Glosario

| Término | Definición |
|---------|------------|
| Tenant | Empresa cliente (`companies`) |
| MRR | Ingreso recurrente mensual |
| RLS | Row Level Security Postgres |
| IMEI | Identificador dispositivo GPS |
| CFDI | Factura electrónica México |
| White label | Marca personalizada partner |

---

## 16. Referencias

- [`ARQUITECTURA_SAAS_TRACKPROGPS.md`](./ARQUITECTURA_SAAS_TRACKPROGPS.md)
- [`MODELO_COMERCIAL_TRACKPROGPS.md`](./MODELO_COMERCIAL_TRACKPROGPS.md)
- [`ENTERPRISE_MANUAL_ADMINISTRADOR.md`](./ENTERPRISE_MANUAL_ADMINISTRADOR.md) — manual operativo flota
- [`PLAN_RESPUESTA_INCIDENTES.md`](./PLAN_RESPUESTA_INCIDENTES.md)

---

## 17. Contacto

- Soporte plataforma: soporte@trackprogps.mx
- Documentación: `docs/TRACKPRO_ENTERPRISE.md`

---

*Prompt 6 — Manual administrador SaaS. Complementa ENTERPRISE_MANUAL_ADMINISTRADOR (operación flota).*
