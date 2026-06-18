# TrackPro GPS — App nativa (Expo)

> **Estrategia actual:** producción en **Web + PWA** ([trackprogps.mx/descargar](https://trackprogps.mx/descargar)).  
> La app nativa está **preparada** para publicar en **App Store** y **Play Store** cuando tengas cuentas de desarrollador.

## Estado

| Canal | Estado |
|-------|--------|
| Web | ✅ Producción |
| PWA (iPhone/Android) | ✅ Producción — canal móvil oficial hoy |
| App iOS (TestFlight / App Store) | ⏸ Listo para build — requiere Apple Developer |
| App Android (APK / Play Store) | ⏸ Listo para build — requiere cuenta Play Console |

## Identidad de la app (ya configurada)

| Campo | Valor |
|-------|--------|
| Nombre | TrackPro GPS |
| Slug Expo | `trackpro-gps` |
| iOS bundle ID | `mx.trackpro.app` |
| Android package | `mx.trackpro.app` |
| Deep link scheme | `trackprogps://` |
| URL producción | `https://trackprogps.mx` |

## Cuando quieras publicar en tiendas

### 1. Configuración única

```bash
cd apps/mobile
cp .env.example .env
npm install
node scripts/generate-expo-assets.mjs
eas login
eas init          # vincula projectId real (reemplaza placeholder en app.json)
```

### 2. Secrets EAS (producción)

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://chegfmvgsohvofdmjslb.supabase.co" --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "TU_ANON_KEY" --environment production
eas env:create --name EXPO_PUBLIC_APP_URL --value "https://trackprogps.mx" --environment production
```

### 3. Builds

```bash
# Android APK interno (pruebas)
npm run build:android

# iOS (TestFlight) — requiere Apple Developer $99/año
npm run build:ios

# Ambas plataformas
npm run build:all
```

### 4. Submit a tiendas

```bash
eas submit --platform android
eas submit --platform ios
```

Documentación detallada: [Expo EAS Submit](https://docs.expo.dev/submit/introduction/)

## Requisitos por plataforma (cuando publiques)

### Apple (iOS)
- Cuenta [Apple Developer Program](https://developer.apple.com/programs/) ($99 USD/año)
- Política de privacidad: https://trackprogps.mx/legal/privacidad
- Capturas de pantalla (6.7", 6.5", iPad si aplica)
- `eas credentials` para certificados (EAS lo gestiona)

### Google (Android)
- Cuenta [Google Play Console](https://play.google.com/console) ($25 USD único)
- Política de privacidad (misma URL)
- Ícono 512×512, feature graphic, capturas
- Service account JSON para submit automático (opcional)

## PWA vs app nativa

| | iPhone | Android |
|---|--------|---------|
| **PWA** (`/descargar`) | Safari → Añadir a inicio ✅ **recomendado hoy** | Instalación desde Chrome ✅ |
| **App nativa** | App Store / TestFlight (futuro) | Play Store / APK (futuro) |

La PWA comparte auth, mapa, alertas y push web con la misma base Supabase. La app nativa añade push Expo/FCM nativo y presencia en tiendas.

## Pantallas implementadas (mobile)

- Login
- Dashboard
- Mapa
- Vehículos
- Alertas

## Notas

- No ejecutes builds de tienda hasta tener cuentas Apple/Google.
- Mientras tanto, indica a clientes iPhone: **trackprogps.mx/descargar**.
