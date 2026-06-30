'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Download, CheckCircle2, Smartphone, Monitor, Globe, RefreshCw } from 'lucide-react'
import { TrackProLogo } from '@/components/brand/trackpro-logo'
import { isStandalonePwa, registerServiceWorker } from '@/lib/pwa/register-sw'
import { getInstallPlatform, isInAppBrowser, isSafariBrowser } from '@/lib/pwa/detect-platform'
import { IosInstallGuide } from '@/components/pwa/ios-install-guide'
import { DesktopInstallGuide } from '@/components/pwa/desktop-install-guide'
import { AndroidInstallGuide } from '@/components/pwa/android-install-guide'
import { AuthLegalFooter } from '@/components/layout/auth-legal-footer'
import { MobilePermissionSetup } from '@/components/mobile/mobile-permission-setup'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export default function DescargarPageClient() {
  const router = useRouter()
  const platform = getInstallPlatform()
  const isIos = platform === 'ios'
  const isAndroid = platform === 'android'
  const isDesktop = platform === 'desktop'
  const inApp = isInAppBrowser()
  const needsSafari = isIos && !isSafariBrowser()

  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [status, setStatus] = useState('')
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)

  const continueToApp = useCallback(() => {
    setDone(true)
    setInstalling(false)
    localStorage.setItem('trackpro_pwa_installed', '1')
    setTimeout(async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      router.push(session ? '/dashboard' : '/register?from=pwa&installed=1')
    }, 1500)
  }, [router])

  const verifyIosInstall = useCallback(() => {
    if (isStandalonePwa()) {
      continueToApp()
      return
    }

    setInstalling(false)
    setStatus('Todavia estas en Safari. Despues de anadir TrackPro a pantalla de inicio, abre la app desde el icono y vuelve a tocar verificar.')
  }, [continueToApp])

  useEffect(() => {
    void registerServiceWorker().finally(() => setReady(true))

    if (isStandalonePwa()) {
      continueToApp()
      return
    }

    const onBip = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      deferredRef.current = e
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [continueToApp])

  async function handleInstall() {
    if (!deferredRef.current) {
      setStatus('Usa las instrucciones de abajo o el menú del navegador.')
      return
    }
    setInstalling(true)
    setStatus('Confirma la instalación en el cuadro del navegador…')
    try {
      await deferredRef.current.prompt()
      const choice = await deferredRef.current.userChoice
      if (choice.outcome === 'accepted') {
        setStatus('¡App instalada!')
        continueToApp()
      } else {
        setInstalling(false)
        setStatus('Instalación cancelada. Puedes usar TrackPro en el navegador.')
      }
    } catch {
      setInstalling(false)
      setStatus('No se pudo abrir el instalador. Sigue los pasos manuales.')
    }
  }

  const title = isIos
    ? 'Instalar en iPhone / iPad'
    : isAndroid
      ? 'Instalar en Android'
      : 'TrackPro GPS en tu computadora'

  const subtitle = isDesktop
    ? 'No se descarga un .exe — instalas desde Chrome/Edge o usas la web directamente.'
    : isIos
      ? 'Añade TrackPro a tu pantalla de inicio con Safari.'
      : 'Instala la app en tu teléfono desde Chrome.'

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <TrackProLogo size="md" className="inline-flex mb-2" />

        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="text-sm text-white/60 mt-1">{subtitle}</p>
        </div>

        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 text-left shadow-2xl">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-green-200">¡Listo! Redirigiendo…</p>
            </div>
          ) : (
            <>
              {!ready && (
                <p className="text-sm text-white/60 text-center py-2">Preparando instalador…</p>
              )}

              {ready && canInstall && (
                <button
                  type="button"
                  disabled={installing}
                  onClick={() => void handleInstall()}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-3.5 rounded-xl text-sm transition mb-4"
                >
                  {isDesktop ? (
                    <Monitor className="w-5 h-5" />
                  ) : (
                    <Smartphone className="w-5 h-5" />
                  )}
                  {installing ? 'Esperando confirmación…' : 'Instalar TrackPro GPS'}
                </button>
              )}

              {status && (
                <p className="text-xs text-orange-200/90 text-center mb-4">{status}</p>
              )}

              {ready && !isDesktop && (
                <div className="mb-4">
                  <MobilePermissionSetup compact />
                </div>
              )}

              {ready && isIos && (
                <>
                  <IosInstallGuide inAppBrowser={inApp || needsSafari} />
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={verifyIosInstall}
                      className="w-full flex items-center justify-center gap-2 border border-white/15 hover:bg-white/5 text-white font-medium py-3 rounded-xl text-sm transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Verificar instalacion
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="w-full flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 text-white/70 font-medium py-3 rounded-xl text-sm transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Actualizar pagina
                    </button>
                  </div>
                </>
              )}

              {ready && isDesktop && !canInstall && <DesktopInstallGuide />}

              {ready && isAndroid && !canInstall && <AndroidInstallGuide />}

              {ready && (
                <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-2">
                  <Link
                    href="/login"
                    className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium py-3 rounded-xl text-sm transition"
                  >
                    <Globe className="w-4 h-4" />
                    Usar en el navegador (sin instalar)
                  </Link>
                  <Link
                    href="/register?from=pwa"
                    className="w-full text-center text-sm text-white/50 hover:text-white/70 py-2"
                  >
                    Crear cuenta nueva →
                  </Link>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full flex items-center justify-center gap-2 text-sm text-white/45 hover:text-white/70 py-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Actualizar
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-[11px] text-white/40 max-w-sm mx-auto space-y-1">
          <p>
            {isDesktop
              ? 'Apps nativas (.exe / App Store) estarán disponibles cuando publiquemos en tiendas. Hoy el canal oficial es web + PWA.'
              : 'TrackPro GPS funciona como app instalada (PWA) sin pasar por tiendas de aplicaciones.'}
          </p>
          {!isDesktop && (
            <p>Después de instalar podrás registrarte y explorar la plataforma en modo demo.</p>
          )}
        </div>

        {!isDesktop && !done && (
          <p className="text-xs text-white/30 flex items-center justify-center gap-1">
            <Download className="w-3.5 h-3.5" />
            No descarga archivos APK/IPA desde esta página
          </p>
        )}

        <div className="mt-8 max-w-sm mx-auto w-full">
          <AuthLegalFooter variant="dark" supportSource="descargar" />
        </div>
      </div>
    </div>
  )
}
