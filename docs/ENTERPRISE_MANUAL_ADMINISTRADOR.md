# TrackProGPS — Manual del administrador

**Audiencia:** `admin_empresa`, `supervisor`, `super_admin`

---

## 1. Acceso y roles

| Rol | Capacidades |
|-----|-------------|
| admin_empresa | Flota completa, usuarios, billing, configuración |
| supervisor | Flota, alertas, reportes, geocercas |
| super_admin | Multi-empresa, soporte, plataforma |

---

## 2. Configuración inicial de empresa

1. **Registro / activación** — email de bienvenida, enlace activación
2. **Plan y facturación** — `/billing`, Stripe checkout
3. **Usuarios** — `/settings` invitar; roles por persona
4. **Grupos de vehículos** — flotillas / particulares
5. **Reglas de alerta** — seed defaults o personalizar

---

## 3. Gestión de dispositivos

### GPS físicos (Teltonika, etc.)

1. `/devices` → Registrar dispositivo (IMEI 15 dígitos)
2. Vincular a vehículo en `/vehicles`
3. Configurar APN/SMS según [`TELTONIKA_SETUP.md`](./TELTONIKA_SETUP.md)
4. Verificar estado **En línea** en mapa

### Teléfonos móviles

1. Usuario instala **TrackProGPS Mobile** e inicia sesión
2. Tab **Rastreo** → Activar rastreo
3. Admin monitorea en `/mobile`
4. **Cierre remoto:** pausar rastreo y revocar sesión

### Pre-registro móvil (admin)

`Dispositivos → Registrar` con `source_type: mobile` y usuario asignado.

---

## 4. Geocercas y alertas

- **Geocercas:** `/geofences` — dibujar zona, alertas entrada/salida
- **Reglas:** `/settings` — velocidad, ignición, movimiento
- **Alertas activas:** `/alerts` — reconocer, filtrar severidad

---

## 5. TrackPro AI (cuando esté activo en plan)

- Acceso desde sidebar o dashboard
- Preguntas en español sobre flota real
- Reportes automáticos: configurar frecuencia en settings
- **Límites:** según plan contratado

---

## 6. Automatización / Playbooks (futuro)

- `/automation` — crear reglas SI/ENTONCES
- Templates: horario laboral, zona restringida, batería baja
- Webhooks a ERP/Slack del cliente
- Revisar log de ejecuciones

---

## 7. API e integraciones (futuro)

- `/settings/api-keys` — crear, rotar, revocar
- Permisos: read, read:history, read:alerts
- Documentación: `/developers`
- Webhooks salientes en playbooks

---

## 8. Reportes

- **Historial:** `/history` — reproducción ruta
- **Reportes:** `/reports` — export CSV/PDF
- **Analítica:** `/analytics` (futuro) — KPIs ejecutivos
- **Reportes IA:** programar resumen diario/semanal

---

## 9. Usuarios y seguridad

- Invitar con rol mínimo necesario
- Desactivar usuarios en lugar de borrar
- Reenviar activación desde `/admin/users`
- **2FA** (futuro): obligatorio para admins enterprise
- Revisar `audit_logs` / security events

---

## 10. White label (plan enterprise)

- Logo y colores en settings
- Dominio custom (soporte TrackPro)
- Emails desde dominio cliente

---

## 11. Soporte

- Modal soporte en login/footer
- Panel `/admin/support` (equipo interno)
- Legal: términos, privacidad, instalación GPS

---

## 12. Checklist operativo diario

- [ ] Revisar alertas críticas sin reconocer
- [ ] Verificar dispositivos offline >24h
- [ ] Revisar móviles con batería baja
- [ ] Confirmar ingesta GPS (mapa actualizado)
- [ ] Revisar reporte IA diario (si activo)

---

*Manual administrador v1.0 — actualizar al lanzar módulos enterprise.*
