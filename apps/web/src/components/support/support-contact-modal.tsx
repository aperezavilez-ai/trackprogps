'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, X, CheckCircle, MessageCircle } from 'lucide-react'
import { LEGAL } from '@/lib/legal/site-legal'
import { PhoneInputField } from '@/components/support/phone-input-field'

interface Props {
  open: boolean
  source: 'login' | 'register' | 'descargar' | 'other'
  onClose: () => void
}

export function SupportContactModal({ open, source, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const [openCount, setOpenCount] = useState(0)

  useEffect(() => {
    if (open) setOpenCount(c => c + 1)
  }, [open])

  if (!open) return null

  function resetAndClose() {
    setEmail('')
    setPhone('')
    setMessage('')
    setAcceptedPrivacy(false)
    setWebsite('')
    setError('')
    setDone(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim(),
          message: message.trim(),
          source,
          website,
          acceptedPrivacy: acceptedPrivacy ? true : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={resetAndClose}
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-950 text-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold">Contactar soporte</h2>
          </div>
          <button type="button" onClick={resetAndClose} className="p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="font-medium text-gray-900">Consulta enviada</p>
              <p className="text-sm text-gray-500 mt-2">
                Te responderemos a <strong>{email}</strong> lo antes posible.
              </p>
              <button
                type="button"
                onClick={resetAndClose}
                className="mt-6 w-full bg-orange-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-orange-600"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-500">
                Cuéntanos tu duda. No necesitas tener cuenta.
              </p>

              <input
                type="text"
                name="website"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <PhoneInputField
                  value={phone}
                  onChange={setPhone}
                  required
                  disabled={loading}
                  resetKey={openCount}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consulta *</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  minLength={20}
                  rows={4}
                  placeholder="Describe tu problema o pregunta…"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={e => setAcceptedPrivacy(e.target.checked)}
                  required
                  className="rounded mt-0.5"
                />
                <span>
                  Acepto la{' '}
                  <Link href="/legal/privacidad" target="_blank" className="text-orange-600 hover:underline">
                    Política de privacidad
                  </Link>
                </span>
              </label>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium py-3 rounded-xl text-sm"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : 'Enviar consulta'}
              </button>

              <p className="text-[11px] text-gray-400 text-center">
                También puedes escribir a{' '}
                <a href={`mailto:${LEGAL.supportEmail}`} className="text-orange-600 hover:underline">
                  {LEGAL.supportEmail}
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
