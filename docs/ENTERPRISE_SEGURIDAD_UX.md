# TrackProGPS Enterprise — Seguridad y UX (Fases 11–12)

---

## Fase 11 — Seguridad empresarial

### 11.1 Estado actual

| Control | Estado |
|---------|--------|
| Auth Supabase + RLS | ✓ |
| HTTPS everywhere | ✓ |
| Stripe webhooks signed | ✓ |
| Mobile JWT + sessions | ✓ |
| API keys schema | Parcial |
| Audit logs | `audit_logs` básico |
| 2FA / SSO | ✗ |
| RBAC middleware | Parcial |

### 11.2 Roadmap seguridad

#### P1 — Corto plazo

| Item | Descripción |
|------|-------------|
| Audit log ampliado | Toda acción admin, API key use, IA queries |
| API key hashing | Ya SHA256; agregar rotación UI |
| Rate limiting | `/api/auth/register`, `/api/mobile/*`, `/api/v1/*` |
| RBAC uniforme | Middleware + API guards |
| Secrets rotation | Documentar ciclo Fly/Vercel/Supabase |

#### P2 — Medio plazo

| Item | Descripción |
|------|-------------|
| 2FA TOTP | Supabase MFA |
| SSO SAML/OIDC | Enterprise tier |
| IP allowlist | Por company para API keys |
| WAF | Cloudflare delante Vercel |
| Pen test anual | Checklist OWASP |

#### P3 — Enterprise

| Item | Descripción |
|------|-------------|
| SOC2 Type I prep | Políticas + logging |
| Detección amenazas | Failed login spikes, API abuse |
| Cifrado at-rest audit | Supabase + backups |
| DLP export | Limitar CSV masivos por rol |

### 11.3 Schema audit ampliado

```sql
-- Extender audit_logs o crear security_events
CREATE TABLE security_events (
  id uuid PRIMARY KEY,
  company_id uuid,
  user_id uuid,
  event_type varchar(50) NOT NULL,
  ip_address inet,
  user_agent text,
  resource_type varchar(50),
  resource_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

Eventos: `login`, `logout`, `api_key_used`, `permission_denied`, `data_export`, `ai_query`, `playbook_executed`.

### 11.4 Políticas empresariales

Configurables en `companies.settings.security`:

```json
{
  "password_min_length": 12,
  "session_timeout_minutes": 480,
  "require_2fa": false,
  "ip_allowlist": [],
  "data_retention_days": 365,
  "allow_mobile_mock_location": false
}
```

---

## Fase 12 — Experiencia de usuario

### 12.1 Principios UX enterprise

1. **Un solo panel** — vehículos, móviles, IoT, IA, reportes
2. **Jerarquía visual** — KPI → detalle → acción
3. **Mobile-first ops** — supervisores en campo
4. **Accesibilidad** — WCAG 2.1 AA objetivo
5. **Personalización** — dashboard widgets por rol

### 12.2 Mejoras por área

| Área | Mejora | Prioridad |
|------|--------|-----------|
| Dashboard | Widgets drag-drop, KPIs enterprise | P1 |
| Mapa | Filtros asset (hecho), iconos móvil/IoT | P1 |
| Navegación | Agrupar IA + Analytics + Automatización | P1 |
| Mobile | Modo conductor simplificado | P2 |
| Onboarding | Wizard primera flota | P2 |
| Dark mode | Tema sistema | P3 |
| i18n | ES → EN PT | P3 |

### 12.3 Nueva estructura nav propuesta

```
Principal
  Dashboard
  Mapa en vivo
  TrackPro AI        ← nuevo hub
  Analítica          ← Fase 3

Flota
  Vehículos
  Dispositivos GPS
  Móviles
  Clientes / Conductores
  Geocercas

Operaciones
  Alertas
  Automatización     ← Playbooks
  Historial
  Rutas              ← Fase 4
  Mantenimiento
  Reportes

Cuenta
  Configuración
  API / Integraciones
  Facturación
  Admin
```

### 12.4 Design system

- Mantener Tailwind + componentes actuales
- Tokens: `companies.settings.branding` override CSS variables
- Componentes shared en `packages/ui` (futuro)

### 12.5 Benchmark UX

Referencia: Samsara, Geotab, Motive — sin copiar; adaptar a mercado MX/LATAM:
- Español nativo
- CFDI/billing MX
- Soporte integrado (ya v1)

---

*Manuales de usuario en [`ENTERPRISE_MANUAL_USUARIO.md`](./ENTERPRISE_MANUAL_USUARIO.md)*
