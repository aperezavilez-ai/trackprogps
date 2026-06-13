'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MapPin, Loader2, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Step 1: Company info
  const [companyName, setCompanyName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')

  // Step 2: Admin user
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setLoading(true)
    setError('')

    try {
      // 1. Create company + subscription via API
      const companyRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, companyEmail, companyPhone, fullName, email, password }),
      })
      const companyData = await companyRes.json()
      if (!companyRes.ok) throw new Error(companyData.error || 'Error al registrar empresa')

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Cuenta creada!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Revisa tu correo <strong>{email}</strong> para confirmar tu cuenta. Tienes 14 días de prueba gratuita.
          </p>
          <Link href="/login" className="block w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium text-center hover:bg-blue-700">
            Ir al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">TrackPro</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Step indicator */}
          <div className="flex gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>

          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {step === 1 ? 'Datos de tu empresa' : 'Crear administrador'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">Paso {step} de 2 • 14 días de prueba gratuita</p>

          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2) } : handleRegister} className="space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la empresa</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Transportes García S.A."
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo de la empresa</label>
                  <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} required placeholder="contacto@empresa.com"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                  <input type="tel" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="+52 55 1234 5678"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Juan García López"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tu correo (admin)</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@empresa.com"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mín. 8 caracteres"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              {step === 2 && (
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Atrás
                </button>
              )}
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta...</> : step === 1 ? 'Siguiente' : 'Crear cuenta'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">¿Ya tienes cuenta? <Link href="/login" className="text-blue-600 font-medium hover:text-blue-700">Ingresar</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
