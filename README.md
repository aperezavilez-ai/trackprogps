# TrackPro GPS — SaaS de Monitoreo Vehicular

Plataforma GPS SaaS multiempresa completa. Inspirada en Protrack GPS, construida con stack moderno y preparada para miles de dispositivos simultáneos.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Shadcn/UI |
| Backend | Supabase (Postgres + Auth + Realtime) |
| GPS Server | Node.js TCP (Teltonika Codec 8/8E) |
| Cola | BullMQ + Redis |
| Mapas | Google Maps API |
| IA | Claude API (Anthropic) |
| Pagos | Stripe / Conekta |
| Email | Resend |
| WhatsApp | Meta Cloud API |
| Push | Firebase FCM |
| Deploy GPS | Railway / Fly.io |
| Deploy Web | Vercel |

## Estructura del monorepo

```
gps-saas/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── gps-server/       # Node.js TCP server para Teltonika
│   └── mobile/           # React Native (Expo) - próximamente
├── packages/
│   ├── types/            # Tipos TypeScript compartidos
│   ├── database/         # Helpers de Supabase
│   └── ui/               # Componentes compartidos
├── supabase/
│   ├── migrations/       # SQL migrations (ejecutar en orden)
│   └── functions/        # Edge Functions
└── docker-compose.yml    # Desarrollo local
```

## Requisitos previos

- Node.js 20+
- Docker y Docker Compose
- Cuenta Supabase (plan Pro recomendado para producción)
- API Keys: Google Maps, Stripe, Resend, WhatsApp, Anthropic

## Configuración inicial

### 1. Clonar y configurar entorno

```bash
git clone https://github.com/tu-org/gps-saas
cd gps-saas
cp .env.example .env.local
# Editar .env.local con tus API keys
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

```bash
# Instalar Supabase CLI
npm install -g supabase

# Inicializar (si no existe)
supabase init

# Configurar proyecto
supabase link --project-ref TU_PROJECT_REF

# Ejecutar migraciones
supabase db push

# Habilitar PostGIS en el dashboard de Supabase:
# Database > Extensions > postgis
```

### 4. Configurar Supabase Realtime

En el dashboard de Supabase:
- Database > Replication > Supabase Realtime
- Habilitar tablas: `vehicle_positions`, `alerts`

### 5. Levantar Redis y GPS Server (desarrollo)

```bash
docker-compose up redis gps-server -d
```

### 6. Correr la app web

```bash
npm run dev
# App en http://localhost:3000
# Bull Board en http://localhost:3002
# GPS Server en TCP :5000
```

## Configurar dispositivo Teltonika FMC920

En el software Teltonika Configurator:

1. **GPRS** → Data sending settings:
   - Protocol: TCP
   - Server: IP de tu servidor GPS
   - Port: 5000

2. **Records settings**:
   - Min period: 10 seconds (cuando se mueve)
   - Min saved records: 1
   - Send period: 10 seconds

3. **I/O settings** (habilitar):
   - ID 239: Ignition
   - ID 240: Movement
   - ID 21: GSM Signal
   - ID 199: Total Odometer
   - ID 66: External Voltage
   - ID 67: Battery Voltage

## Deploy en producción

### GPS Server → Railway

```bash
# Instalar Railway CLI
npm install -g @railway/cli
railway login

# Deploy
cd apps/gps-server
railway up

# Variables de entorno en Railway dashboard:
# GPS_SERVER_PORT, REDIS_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### Web App → Vercel

```bash
npm install -g vercel
vercel --prod
# Configurar variables de entorno en Vercel dashboard
```

### Redis → Railway o Upstash

Para producción se recomienda Upstash (serverless Redis) o Railway Redis.

## Módulos implementados

- [x] Fase 0: Arquitectura completa
- [x] Módulo 1: Autenticación (Supabase Auth + RLS)
- [x] Módulo 2: Gestión de empresas y planes
- [x] Módulo 3: Gestión de vehículos
- [x] Módulo 4: Gestión de choferes
- [x] Módulo 5: Servidor GPS (Teltonika FMC920 Codec 8/8E)
- [x] Módulo 6: Mapa en tiempo real (Supabase Realtime + Google Maps)
- [x] Módulo 7: Historial de rutas con reproducción
- [x] Módulo 8: Geocercas (PostGIS)
- [x] Módulo 9: Motor de alertas (velocidad, geocercas, SOS, ignición)
- [x] Módulo 10: Reportes (CSV export)
- [x] Módulo 11: Mantenimiento vehicular
- [x] Módulo 13: Dashboard ejecutivo
- [x] Módulo 14: Facturación (Stripe + Conekta)
- [x] Módulo 15: IA Operativa (Claude API)
- [ ] Módulo 12: App Móvil (React Native - siguiente fase)

## Escalabilidad

| Nivel | Empresas | GPS | Infraestructura |
|-------|----------|-----|-----------------|
| 1 | 100 | 1,000 | Supabase Pro + Railway |
| 2 | 1,000 | 10,000 | Réplicas de lectura + Redis Cluster |
| 3 | 10,000 | 100,000 | TimescaleDB + K8s + Multi-region |

## Licencia

Propietario — todos los derechos reservados.
