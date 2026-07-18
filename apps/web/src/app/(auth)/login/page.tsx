'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { AuthLegalFooter } from '@/components/layout/auth-legal-footer'
import { TrackProLogo } from '@/components/brand/trackpro-logo'
import { Eye, EyeOff, Loader2, User, Lock, Download } from 'lucide-react'

const REMEMBER_KEY = 'trackpro_remember_email'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setEmail(saved)
      setRemember(true)
    }
  }, [])
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(searchParams.get('confirmed') === '1')
  const [error, setError] = useState(
    searchParams.get('error') === 'inactive'
      ? 'Tu cuenta está desactivada. Contacta al administrador.'
      : searchParams.get('error') === 'unconfirmed'
        ? 'Confirma tu correo antes de ingresar.'
        : searchParams.get('error') === 'auth'
          ? 'Enlace inválido o expirado. Solicita uno nuevo.'
          : '',
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : authError.message,
      )
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Error al verificar sesión. Intenta de nuevo.')
      setLoading(false)
      return
    }

    const { data: activeProfile } = await supabase.from('users').select('is_active').eq('id', user.id).single()
    if (activeProfile?.is_active === false) {
      await supabase.auth.signOut()
      setError('Tu cuenta está desactivada. Contacta al administrador.')
      setLoading(false)
      return
    }
    if (!user.email_confirmed_at) {
      await supabase.auth.signOut()
      setError('Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.')
      setLoading(false)
      return
    }

    if (remember) localStorage.setItem(REMEMBER_KEY, email)
    else localStorage.removeItem(REMEMBER_KEY)

    const { data: profile } = await supabase
      .from('users')
      .select('company:companies(status, settings)')
      .eq('id', user.id)
      .single()

    const company = profile?.company as { status: string; settings: Record<string, unknown> | null } | null
    const isDemo =
      company?.status === 'demo' ||
      company?.settings?.['demo_tour'] === true

    if (safeNext) {
      window.location.href = safeNext
      return
    }

    if (isDemo) {
      window.location.href = '/dashboard?demo_tour=1'
      return
    }

    try {
      const pendingRes = await fetch('/api/billing/pending-checkout')
      if (pendingRes.ok) {
        const pendingJson = await pendingRes.json()
        if (pendingJson.data?.plan_id) {
          window.location.href = '/billing?checkout=1&tab=suscripcion'
          return
        }
      }
    } catch {
      // ignore — fall through to dashboard
    }

    router.refresh()
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen relative overflow-hidden text-white">
      {/* Fondo — autopista con flota GPS */}
      <div
        className="absolute inset-0 bg-cover scale-105"
        style={{
          backgroundImage: 'url("/images/login-hero.png")',
          backgroundPosition: 'center 72%',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/50 to-slate-950/70" />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-start justify-between px-5 md:px-10 pt-6 md:pt-8">
          <Link href="/login" className="group">
            <TrackProLogo size="lg" className="group-hover:opacity-95 transition" />
          </Link>
          <Link
            href="/descargar"
            className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 hover:border-white/35 transition"
          >
            <Download className="w-4 h-4" />
            Descargar app
          </Link>
        </header>

        {/* Contenido — panel derecho */}
        <div className="flex-1 flex items-center justify-end px-4 md:px-10 lg:px-16 py-8">
          <div className="w-full max-w-[340px] rounded-lg bg-slate-900/88 border border-white/10 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Cabecera panel */}
            <div className="relative px-6 pt-8 pb-4 flex flex-col items-center border-b border-white/10">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-1">
                <User className="w-8 h-8 text-white/80" />
              </div>
            </div>

            <form onSubmit={handleLogin} className="px-6 py-5 space-y-3" autoComplete="off">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                <input
                  type="email"
                  name="trackpro-email"
                  id="trackpro-login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@trackprogps.mx"
                  required
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full bg-slate-800/90 border border-white/10 rounded-md pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 pointer-events-none z-10" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  name="trackpro-password"
                  id="trackpro-login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  autoComplete="current-password"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full bg-slate-800/90 border border-white/10 rounded-md pl-10 pr-12 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-md text-orange-400 hover:text-orange-300 hover:bg-white/5 transition"
                >
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-white/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-white/30 bg-transparent text-orange-500 focus:ring-orange-400"
                  />
                  Recordarme
                </label>
                <Link href="/forgot-password" className="text-white/70 hover:text-orange-300 transition">
                  ¿Olvidó su contraseña?
                </Link>
              </div>

              {success && (
                <div className="bg-green-500/15 border border-green-400/30 rounded-md px-3 py-2 text-xs text-green-200">
                  Correo confirmado. Ya puedes iniciar sesión.
                </div>
              )}

              {error && (
                <div className="bg-red-500/15 border border-red-400/30 rounded-md px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-3 rounded-md text-sm transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Ingresando...</>
                ) : 'Inicio de sesión'}
              </button>
            </form>

            <div className="px-6 pb-5 text-center">
              <p className="text-xs text-white/50">
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="text-orange-300 hover:text-orange-200">
                  Solicita acceso
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 md:px-10 pb-5">
          <AuthLegalFooter variant="dark" supportSource="login" />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

