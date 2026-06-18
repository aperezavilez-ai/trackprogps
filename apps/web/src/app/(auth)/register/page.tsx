'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, User, Users, Building2 } from 'lucide-react'
import { TrackProLogo } from '@/components/brand/trackpro-logo'
import { ACCOUNT_TYPES } from '@/lib/account-types'
import { PublicPricingPlans } from '@/components/auth/public-pricing-plans'
import { AuthLegalFooter } from '@/components/layout/auth-legal-footer'
import type { AccountType } from '@gps-saas/types'

const TYPE_ICONS = {
  personal: User,
  family: Users,
  business: Building2,
} as const

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const fromPwa = searchParams.get('from') === 'pwa'
  const installed = searchParams.get('installed') === '1'

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [accountType, setAccountType] = useState<AccountType>('personal')
  const [companyName, setCompanyName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [registeredPlanName, setRegisteredPlanName] = useState<string | null>(null)
  const [hasPendingCheckout, setHasPendingCheckout] = useState(false)

  const accountConfig = ACCOUNT_TYPES.find(t => t.value === accountType)!

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (fromPwa && !selectedPlanId) { setError('Selecciona un plan para continuar'); return }
    if (!acceptedTerms) { setError('Debes aceptar los términos y la política de privacidad'); return }

    setLoading(true)
    setError('')

    try {
      const companyRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType,
          companyName: accountType === 'personal' ? (companyName || fullName) : companyName,
          companyEmail,
          companyPhone,
          fullName,
          email,
          password,
          ...(selectedPlanId ? { planId: selectedPlanId, billingPeriod } : {}),
        }),
      })
      const companyData = await companyRes.json()
      if (!companyRes.ok) throw new Error(companyData.error || 'Error al registrar')

      if (companyData.pending_checkout) {
        setHasPendingCheckout(true)
        const planRes = await fetch('/api/plans/public')
        const planJson = await planRes.json()
        const plan = (planJson.data ?? []).find((p: { id: string }) => p.id === selectedPlanId)
        setRegisteredPlanName(plan?.name ?? null)
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Cuenta creada!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Revisa tu correo <strong>{email}</strong> para confirmar tu cuenta. Tienes 14 días de prueba gratuita.
          </p>
          {hasPendingCheckout && registeredPlanName && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-900 mb-4 text-left">
              <p className="font-medium">Plan seleccionado: {registeredPlanName}</p>
              <p className="text-orange-800/90 mt-1">
                Al confirmar tu correo te llevaremos al pago seguro con Stripe. Puedes cancelar antes de finalizar el cobro.
              </p>
            </div>
          )}
          <Link href="/login" className="block w-full bg-orange-500 text-white py-3 rounded-xl text-sm font-medium text-center hover:bg-orange-400">
            Ir al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 py-8">
      <div className={`w-full ${fromPwa ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="text-center mb-6">
          <TrackProLogo size="md" className="inline-flex mb-2" />
          {installed && (
            <p className="text-sm text-green-300/90">App instalada correctamente en tu dispositivo</p>
          )}
        </div>

        {fromPwa && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 mb-4">
            <PublicPricingPlans
              compact={false}
              selectedId={selectedPlanId}
              onSelect={setSelectedPlanId}
              billing={billingPeriod}
              onBillingChange={setBillingPeriod}
              requireSelection
            />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>

          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {step === 1 ? '¿Cómo usarás TrackPro?' : step === 2 ? accountConfig.accountLabel : 'Crear administrador'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">Paso {step} de 3 • 14 días de prueba gratuita</p>

          <form
            onSubmit={
              step === 1 ? (e) => { e.preventDefault(); setStep(2) }
              : step === 2 ? (e) => { e.preventDefault(); setStep(3) }
              : handleRegister
            }
            className="space-y-4"
          >
            {step === 1 && (
              <div className="grid gap-3">
                {ACCOUNT_TYPES.map(t => {
                  const Icon = TYPE_ICONS[t.value]
                  const selected = accountType === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAccountType(t.value)}
                      className={`text-left p-4 rounded-xl border-2 transition ${
                        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{t.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{accountConfig.accountLabel}</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required={accountType !== 'personal'}
                    placeholder={accountConfig.accountPlaceholder}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {accountType === 'personal' && (
                    <p className="text-xs text-gray-400 mt-1">Opcional — si lo dejas vacío usamos tu nombre</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo de contacto</label>
                  <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} required placeholder="contacto@trackprogps.mx"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                  <input type="tel" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="+52 55 1234 5678"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Juan García López"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tu correo (admin)</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="correo@trackprogps.mx"
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
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="rounded mt-0.5"
                    required
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    Acepto los{' '}
                    <Link href="/legal/terminos" target="_blank" className="text-orange-600 hover:underline">Términos y condiciones</Link>
                    {' '}y la{' '}
                    <Link href="/legal/privacidad" target="_blank" className="text-orange-600 hover:underline">Política de privacidad</Link>.
                  </span>
                </label>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <button type="button" onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Atrás
                </button>
              )}
              <button type="submit" disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta...</>
                  : step === 3 ? 'Crear cuenta' : 'Siguiente'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">¿Ya tienes cuenta? <Link href="/login" className="text-orange-600 font-medium hover:text-orange-500">Ingresar</Link></p>
          </div>
          <AuthLegalFooter variant="light" />
        </div>
      </div>
    </div>
  )
}
