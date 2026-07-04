'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Globe, Loader2, Monitor, ShieldCheck, Smartphone } from 'lucide-react'
import { TrackProLogo } from '@/components/brand/trackpro-logo'
import { isStandalonePwa, registerServiceWorker } from '@/lib/pwa/register-sw'
import { getInstallPlatform, isInAppBrowser, isSafariBrowser } from '@/lib/pwa/detect-platform'
import { IosInstallGuide } from '@/components/pwa/ios-install-guide'
import { DesktopInstallGuide } from '@/components/pwa/desktop-install-guide'
import { AndroidInstallGuide } from '@/components/pwa/android-install-guide'
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
  const searchParams = useSearchParams()
  const activationDeviceId = searchParams.get('device_id') ?? undefined
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
  const [standalone, setStandalone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [status, setStatus] = useState('')
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)

  const goToSessionRoute = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    router.push(session ? '/dashboard' : '/register?from=pwa&installed=1')
  }, [router])

  const enterApp = useCallback(() => {
    router.replace('/dashboard')
  }, [router])

  const loginHref = activationDeviceId
    ? `/login?next=${encodeURIComponent(`/descargar?device_id=${activationDeviceId}`)}`
    : '/login'

  const continueToApp = useCallback(() => {
    setDone(true)
    setInstalling(false)
    localStorage.setItem('trackpro_pwa_installed', '1')
    setTimeout(() => {
      void goToSessionRoute()
    }, 500)
  }, [goToSessionRoute])

  const continueInWeb = useCallback(async () => {
    setInstalling(false)
    localStorage.setItem('trackpro_web_continue', '1')
    await goToSessionRoute()
  }, [goToSessionRoute])

  const verifyIosInstall = useCallback(() => {
    if (isStandalonePwa()) {
      setStandalone(true)
      setStatus('')
      return
    }

    setInstalling(false)
    setStatus('Abre TrackPro desde el icono nuevo de tu pantalla de inicio.')
  }, [])

  useEffect(() => {
    const launchedStandalone = isStandalonePwa()
    setStandalone(launchedStandalone)

    void registerServiceWorker().finally(() => setReady(true))
    void createSupabaseBrowserClient().auth.getSession()
      .then(({ data: { session } }) => {
        const validSession = Boolean(session)
        setHasSession(validSession)
        if (launchedStandalone && validSession) {
          router.replace('/dashboard')
        }
      })
      .catch(() => setHasSession(false))
      .finally(() => setSessionChecked(true))

    if (launchedStandalone && isDesktop) {
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
  }, [continueToApp, isDesktop, router])

  async function handleInstall() {
    if (!deferredRef.current) {
      setStatus('Usa el menu del navegador para instalar TrackPro.')
      return
    }

    setInstalling(true)
    setStatus('Confirma la instalacion en el navegador.')
    try {
      await deferredRef.current.prompt()
      const choice = await deferredRef.current.userChoice
      if (choice.outcome === 'accepted') {
        setStatus('App instalada.')
        continueToApp()
      } else {
        setInstalling(false)
        setStatus('Instalacion cancelada.')
      }
    } catch {
      setInstalling(false)
      setStatus('No se pudo abrir el instalador.')
    }
  }

  const title = standalone
    ? 'TrackPro GPS'
    : activationDeviceId
      ? 'Activar movil'
    : isIos
      ? 'Instalar en iPhone'
      : isAndroid
        ? 'Instalar en Android'
        : 'TrackPro GPS'

  const subtitle = standalone
    ? 'Abriendo tu sesion segura.'
    : activationDeviceId
      ? 'Abre esta pantalla desde el telefono asignado.'
    : isIos
      ? 'Agregala a inicio desde Safari.'
      : isAndroid
        ? 'Instala o continua en el navegador.'
        : 'Instala o continua en el navegador.'

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-5">
        <TrackProLogo size="md" className="inline-flex" />

        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="text-sm text-white/60 mt-1">{subtitle}</p>
        </div>

        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 text-left shadow-2xl">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-green-200">Listo. Abriendo TrackPro...</p>
            </div>
          ) : activationDeviceId && isDesktop ? (
            <div className="text-center">
              <ShieldCheck className="w-10 h-10 text-orange-300 mx-auto mb-3" />
              <p className="text-sm text-white/70">
                Abre este enlace desde el telefono asignado para autorizar TrackPro.
              </p>
            </div>
          ) : standalone && !isDesktop ? (
            !sessionChecked ? (
              <div className="flex items-center justify-center gap-2 text-sm text-white/60 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando sesion...
              </div>
            ) : hasSession === false ? (
              <div className="text-center">
                <ShieldCheck className="w-10 h-10 text-orange-300 mx-auto mb-3" />
                <p className="text-sm text-white/70 mb-4">
                  Inicia sesion en este telefono para entrar a TrackPro.
                </p>
                <Link
                  href={loginHref}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-medium py-3 rounded-xl text-sm transition"
                >
                  Iniciar sesion
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-green-200 mb-4">Sesion lista.</p>
                <button
                  type="button"
                  onClick={enterApp}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-medium py-3 rounded-xl text-sm transition"
                >
                  Entrar a TrackPro
                </button>
              </div>
            )
          ) : activationDeviceId && !isDesktop ? (
            hasSession === null ? (
              <p className="text-sm text-white/60 text-center py-2">Preparando...</p>
            ) : hasSession === false ? (
              <div className="text-center">
                <ShieldCheck className="w-10 h-10 text-orange-300 mx-auto mb-3" />
                <p className="text-sm text-white/70 mb-4">
                  Inicia sesion en este telefono para autorizar TrackPro.
                </p>
                <Link
                  href={loginHref}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-medium py-3 rounded-xl text-sm transition"
                >
                  Iniciar sesion
                </Link>
              </div>
            ) : (
              <MobilePermissionSetup
                compact
                deviceId={activationDeviceId}
                title="Activar rastreo"
                description="Autoriza ubicacion para enviar el movil en vivo. Puedes entrar aunque falle y reintentar despues."
                continueOnRegistered
                onActivated={continueToApp}
                onSkip={enterApp}
              />
            )
          ) : (
            <>
              {!ready && (
                <p className="text-sm text-white/60 text-center py-2">Preparando...</p>
              )}

              {ready && canInstall && (
                <button
                  type="button"
                  disabled={installing}
                  onClick={() => void handleInstall()}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-3.5 rounded-xl text-sm transition mb-4"
                >
                  {isDesktop ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  {installing ? 'Esperando...' : 'Instalar TrackPro'}
                </button>
              )}

              {ready && isIos && (
                <>
                  <IosInstallGuide inAppBrowser={inApp || needsSafari} />
                  <button
                    type="button"
                    onClick={verifyIosInstall}
                    className="mt-4 w-full flex items-center justify-center gap-2 border border-white/15 hover:bg-white/5 text-white font-medium py-3 rounded-xl text-sm transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Ya abri desde el icono
                  </button>
                </>
              )}

              {ready && isDesktop && !canInstall && <DesktopInstallGuide />}

              {ready && isAndroid && !canInstall && <AndroidInstallGuide />}

              {status && (
                <p className="text-xs text-orange-200/90 text-center mt-4">{status}</p>
              )}

              {ready && (
                <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void continueInWeb()}
                    className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium py-3 rounded-xl text-sm transition"
                  >
                    <Globe className="w-4 h-4" />
                    Continuar en web
                  </button>
                  <Link
                    href="/register?from=pwa"
                    className="w-full text-center text-sm text-white/50 hover:text-white/70 py-2"
                  >
                    Crear cuenta
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
