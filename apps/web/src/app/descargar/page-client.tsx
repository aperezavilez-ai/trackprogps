'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, CheckCircle2, Smartphone } from 'lucide-react'
import { TrackProLogo } from '@/components/brand/trackpro-logo'
import { messageForProgress } from '@/lib/pwa/install-steps'
import { isStandalonePwa, registerServiceWorker } from '@/lib/pwa/register-sw'
import { getInstallPlatform, isInAppBrowser, isSafariBrowser } from '@/lib/pwa/detect-platform'
import { IosInstallGuide } from '@/components/pwa/ios-install-guide'

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
  const skipAnimation = searchParams.get('installed') === '1'
  const platform = getInstallPlatform()
  const isIos = platform === 'ios'
  const inApp = isInAppBrowser()
  const needsSafari = isIos && !isSafariBrowser()

  const [progress, setProgress] = useState(skipAnimation ? 100 : 0)
  const [status, setStatus] = useState(
    skipAnimation ? '¡Instalación completada!'
      : isIos ? 'Preparando instalación para iPhone...'
        : 'Iniciando instalación...'
  )
  const [done, setDone] = useState(skipAnimation)
  const [canInstall, setCanInstall] = useState(false)
  const [installing, setInstalling] = useState(!skipAnimation && !isIos)
  const [iosReady, setIosReady] = useState(false)
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)
  const finishedRef = useRef(false)

  const finishInstall = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setProgress(100)
    setStatus('¡Instalación completada!')
    setDone(true)
    setInstalling(false)
    localStorage.setItem('trackpro_pwa_installed', '1')
    setTimeout(() => {
      router.push('/register?from=pwa&installed=1')
    }, 1800)
  }, [router])

  useEffect(() => {
    void registerServiceWorker()

    if (isStandalonePwa()) {
      finishInstall()
      return
    }

    const onBip = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      deferredRef.current = e
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    if (skipAnimation) return () => window.removeEventListener('beforeinstallprompt', onBip)

    // iOS: no hay prompt automático — mostrar guía Safari y barra de progreso suave
    if (isIos) {
      let current = 0
      const interval = setInterval(() => {
        current = Math.min(92, current + 1.5 + Math.random() * 2)
        setProgress(Math.round(current))
        setStatus(
          current < 40 ? 'Preparando paquete para iPhone...'
            : current < 75 ? 'Configurando mapa y alertas...'
              : 'Sigue los pasos de Safari para instalar'
        )
        if (current >= 92) {
          clearInterval(interval)
          setInstalling(false)
          setIosReady(true)
        }
      }, 220)
      return () => {
        clearInterval(interval)
        window.removeEventListener('beforeinstallprompt', onBip)
      }
    }

    let current = 0
    const interval = setInterval(() => {
      const bump = current < 30 ? 2 + Math.random() * 3
        : current < 70 ? 1 + Math.random() * 2
          : current < 95 ? 0.4 + Math.random() * 1.2
            : 0.2 + Math.random() * 0.5
      current = Math.min(100, current + bump)
      setProgress(Math.round(current))
      setStatus(messageForProgress(current))

      if (current >= 100) {
        clearInterval(interval)
        void (async () => {
          if (deferredRef.current) {
            try {
              await deferredRef.current.prompt()
              const choice = await deferredRef.current.userChoice
              if (choice.outcome === 'accepted') {
                finishInstall()
                return
              }
            } catch { /* continuar */ }
          }
          finishInstall()
        })()
      }
    }, 280)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeinstallprompt', onBip)
    }
  }, [skipAnimation, finishInstall, isIos])

  async function handleManualInstall() {
    if (!deferredRef.current) {
      setStatus('Usa el menú del navegador: Instalar app o Añadir a pantalla de inicio')
      return
    }
    setInstalling(true)
    setStatus('Solicitando instalación en el dispositivo...')
    await deferredRef.current.prompt()
    const choice = await deferredRef.current.userChoice
    if (choice.outcome === 'accepted') {
      finishInstall()
    } else {
      setInstalling(false)
      setStatus('Instalación cancelada. Puedes continuar en el navegador.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <TrackProLogo size="md" className="inline-flex mb-2" />

        <p className="text-sm text-white/60">
          {isIos
            ? 'Instalación optimizada para iPhone (Safari)'
            : 'Instalación de la aplicación móvil'}
        </p>

        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 text-left shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            {done ? (
              <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" />
            ) : (
              <Download className={`w-8 h-8 text-orange-400 flex-shrink-0 ${installing ? 'animate-bounce' : ''}`} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/50 uppercase tracking-wide">Estado</p>
              <p className="text-sm font-medium text-white/90">{status}</p>
            </div>
            <span className="text-lg font-bold text-orange-400 tabular-nums">{progress}%</span>
          </div>

          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {isIos && (iosReady || progress >= 90) && !done && (
            <IosInstallGuide inAppBrowser={inApp || needsSafari} />
          )}

          {isIos && iosReady && !done && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={finishInstall}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-medium py-3 rounded-xl text-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Ya instalé la app — continuar
              </button>
              <button
                type="button"
                onClick={() => router.push('/register?from=pwa')}
                className="w-full text-sm text-white/50 hover:text-white/70 py-2"
              >
                Continuar sin instalar →
              </button>
            </div>
          )}

          {!isIos && canInstall && !done && progress >= 55 && progress < 100 && (
            <button
              type="button"
              onClick={() => void handleManualInstall()}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-medium py-3 rounded-xl text-sm transition"
            >
              <Smartphone className="w-4 h-4" />
              Instalar en este dispositivo
            </button>
          )}

          {done && (
            <p className="mt-4 text-xs text-green-300/90 text-center">
              Redirigiendo al registro y planes...
            </p>
          )}

          {!isIos && !installing && !done && (
            <button
              type="button"
              onClick={() => router.push('/register?from=pwa')}
              className="mt-5 w-full text-sm text-orange-300 hover:text-orange-200"
            >
              Continuar sin instalar →
            </button>
          )}
        </div>

        <p className="text-[11px] text-white/40 max-w-sm mx-auto">
          {isIos
            ? 'Usa Safari en tu iPhone. Después crea tu cuenta, elige plan y activa 14 días de prueba.'
            : 'Al completar la instalación podrás crear tu cuenta, elegir plan y activar tu prueba gratuita de 14 días.'}
        </p>
      </div>
    </div>
  )
}
