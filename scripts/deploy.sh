#!/usr/bin/env bash
# ============================================================
# TrackPro GPS — Script de deploy completo
# Ejecutar desde la raíz del monorepo
# ============================================================
set -e

echo "🚀 TrackPro GPS Deploy Script"
echo "============================="

# -----------------------------------------------
# 1. Verificar dependencias
# -----------------------------------------------
check_dep() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ $1 no encontrado. Instálalo primero."
    exit 1
  fi
  echo "✅ $1 disponible"
}

echo ""
echo "📋 Verificando dependencias..."
check_dep node
check_dep npm
check_dep docker
check_dep supabase

NODE_VERSION=$(node -v | cut -c2-3)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ requerido (tienes $(node -v))"
  exit 1
fi

# -----------------------------------------------
# 2. Verificar variables de entorno
# -----------------------------------------------
echo ""
echo "🔑 Verificando variables de entorno..."

if [ ! -f ".env.local" ]; then
  echo "⚠️  .env.local no encontrado. Copiando de .env.example..."
  cp .env.example .env.local
  echo "❌ Edita .env.local con tus API keys antes de continuar."
  exit 1
fi

REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
  "ANTHROPIC_API_KEY"
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=.\+" .env.local; then
    echo "❌ Falta: $var"
    MISSING=1
  else
    echo "✅ $var configurado"
  fi
done

if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "Configura las variables faltantes en .env.local"
  exit 1
fi

# -----------------------------------------------
# 3. Instalar dependencias
# -----------------------------------------------
echo ""
echo "📦 Instalando dependencias..."
npm install

# -----------------------------------------------
# 4. Build de tipos compartidos
# -----------------------------------------------
echo ""
echo "🔨 Compilando tipos..."
cd packages/types && npm run build && cd ../..

# -----------------------------------------------
# 5. Migraciones de base de datos
# -----------------------------------------------
echo ""
echo "🗄️  Ejecutando migraciones de Supabase..."
supabase db push --linked

echo ""
echo "🌱 ¿Ejecutar datos de demo? (s/N)"
read -r response
if [[ "$response" =~ ^[Ss]$ ]]; then
  supabase db execute --file supabase/seed/01_demo_data.sql
  echo "✅ Datos de demo cargados"
fi

# -----------------------------------------------
# 6. Levantar servicios locales con Docker
# -----------------------------------------------
echo ""
echo "🐳 Iniciando Redis y GPS Server..."
docker-compose up -d redis gps-server

echo "⏳ Esperando a que Redis esté listo..."
sleep 3

docker-compose ps

# -----------------------------------------------
# 7. Build de la app web
# -----------------------------------------------
echo ""
echo "🔨 Build de Next.js..."
cd apps/web && npm run build && cd ../..

echo ""
echo "=============================="
echo "✅ Build completado con éxito!"
echo "=============================="
echo ""
echo "Para desarrollo local:"
echo "  npm run dev           — Inicia toda la plataforma"
echo "  localhost:3000        — App web"
echo "  localhost:3001/health — GPS Server health check"
echo "  localhost:3002        — Bull Board (colas)"
echo "  TCP :5000             — Puerto GPS para dispositivos"
echo ""
echo "Para producción:"
echo "  apps/web → Vercel"
echo "  apps/gps-server → Railway (variables: GPS_SERVER_PORT, REDIS_URL, SUPABASE_*)"
echo "  Redis → Upstash o Railway Redis"
echo ""
echo "📚 Documentación completa: README.md"
