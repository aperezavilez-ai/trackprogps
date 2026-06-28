'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
import { TrackProLogo } from '@/components/brand/trackpro-logo'

export default function ActivarCuentaPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session)
      setLoading(false)
      if (!session) {
        setError('El enlace expiró o ya fue usado. Pide a tu administrador que reenvíe la activación o usa Olvidé mi contraseña si ya tenías cuenta.')
      }
    })
  }, [supabase.auth])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <TrackProLogo size="md" className="inline-flex mb-4" />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : done ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">Cuenta activada</h2>
              <p className="text-sm text-gray-500 mt-2">Entrando al panel…</p>
            </div>
          ) : !ready ? (
            <div className="text-center space-y-3">
              <h1 className="text-lg font-semibold text-gray-900">Enlace no válido</h1>
              <p className="text-sm text-red-600">{error}</p>
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/forgot-password" className="text-sm text-orange-500 hover:underline">
                  Olvidé mi contraseña
                </Link>
                <Link href="/login" className="text-sm text-gray-500 hover:underline">
                  Volver al inicio de sesión
                </Link>
              </div>
            </div>
          ) : (
            <>
              <Link href="/login" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
                <ArrowLeft className="w-4 h-4" /> Volver
              </Link>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Activa tu cuenta</h1>
              <p className="text-sm text-gray-500 mb-6">
                Crea tu contraseña para acceder a TrackPro GPS. No compartas este enlace con nadie.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Activando…</> : 'Activar cuenta y entrar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
