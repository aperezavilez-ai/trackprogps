# TrackProGPS — Guía de despliegue

---

## 1. Entornos

| Entorno | Web | GPS | DB |
|---------|-----|-----|-----|
| Producción | Vercel prod | Fly.io | Supabase prod |
| Preview | Vercel PR | — | Supabase staging |
| Local | localhost:3000 | localhost:5000 | Supabase local / remoto |

---

## 2. Despliegue web (Vercel)

```bash
cd apps/web
vercel --prod --yes
```

**Post-deploy:**
- Verificar deployment `Ready`
- Probar login, mapa, `/mobile`
- URL: https://trackprogps.mx

**Variables:** configurar en Vercel dashboard o `scripts/set-vercel-env.mjs`

---

## 3. Despliegue GPS server (Fly.io)

```bash
npm run deploy:gps -- --deploy-only
```

**Verificación:**
```bash
flyctl status -a trackpro-gps-server
curl https://trackpro-gps-server.fly.dev/health
```

**Secrets Fly:**
```
SUPABASE_SERVICE_ROLE_KEY
REDIS_URL
```

---

## 4. Migraciones base de datos

```bash
# Aplicar migración específica
node scripts/apply-migrations-027.mjs [DB_PASSWORD]

# O batch
node scripts/run-migrations.mjs
```

**Orden:** siempre migración **antes** de deploy código dependiente.

---

## 5. Edge Functions

```bash
npm run deploy:edge
node scripts/sync-edge-secrets.mjs
```

---

## 6. Mobile (EAS)

```bash
cd apps/mobile
npm install
eas build --platform android --profile production
eas build --platform ios --profile production
```

Configurar `eas.json` con `EXPO_PUBLIC_*` secrets.

---

## 7. Checklist release enterprise

- [ ] Migraciones aplicadas en prod
- [ ] `packages/types` build si hubo cambios
- [ ] Web build local OK
- [ ] Deploy Vercel prod
- [ ] Deploy GPS si tocó `apps/gps-server`
- [ ] Smoke test: login, mapa, mobile API, IA (si aplica)
- [ ] Documentación actualizada en `docs/`

---

## 8. Rollback

| Servicio | Acción |
|----------|--------|
| Vercel | Redeploy deployment anterior en dashboard |
| Fly | `flyctl releases rollback -a trackpro-gps-server` |
| DB | **No** rollback destructivo; migraciones forward-only |

---

## 9. Dominios

- `trackprogps.mx` → Vercel
- White label: CNAME cliente → Vercel + config proyecto

---

*Guía despliegue v1.0*
