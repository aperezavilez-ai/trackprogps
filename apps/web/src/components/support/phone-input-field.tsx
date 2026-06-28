'use client'

import { useEffect, useState } from 'react'
import {
  COUNTRY_DIAL_CODES,
  detectDefaultCountryIso,
  formatPhoneE164,
  getCountryByIso,
  nationalDigitsOnly,
} from '@/lib/phone/country-codes'

interface Props {
  value: string
  onChange: (e164: string) => void
  required?: boolean
  disabled?: boolean
  /** Reinicia detección cuando el modal se abre */
  resetKey?: number | string
}

export function PhoneInputField({ value, onChange, required, disabled, resetKey }: Props) {
  const [countryIso, setCountryIso] = useState('MX')
  const [national, setNational] = useState('')
  const [autoDetected, setAutoDetected] = useState(false)
  const [manualOverride, setManualOverride] = useState(false)

  const country = getCountryByIso(countryIso)

  useEffect(() => {
    if (resetKey === undefined) return
    const detected = detectDefaultCountryIso()
    setCountryIso(detected)
    setAutoDetected(true)
    setManualOverride(false)
    setNational('')
    onChange('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    if (!value) return
    const match = COUNTRY_DIAL_CODES.find(c => value.startsWith(c.dial))
    if (match) {
      setCountryIso(match.iso)
      setNational(value.slice(match.dial.length).replace(/\D/g, ''))
    }
  }, [value])

  function updateNational(next: string) {
    const digits = nationalDigitsOnly(next)
    setNational(digits)
    onChange(digits ? formatPhoneE164(country.dial, digits) : '')
  }

  function updateCountry(iso: string) {
    setCountryIso(iso)
    setManualOverride(true)
    setAutoDetected(false)
    const c = getCountryByIso(iso)
    onChange(national ? formatPhoneE164(c.dial, national) : '')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative shrink-0 w-[7.5rem] sm:w-32">
          <select
            value={countryIso}
            onChange={e => updateCountry(e.target.value)}
            disabled={disabled}
            aria-label="Código de país"
            className="w-full appearance-none border border-gray-300 rounded-xl pl-3 pr-8 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
          >
            {COUNTRY_DIAL_CODES.map(c => (
              <option key={c.iso} value={c.iso}>
                {c.flag} {c.dial}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={national}
          onChange={e => updateNational(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder="667 123 4567"
          autoComplete="tel-national"
          className="flex-1 min-w-0 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
        />
      </div>
      {autoDetected && !manualOverride && (
        <p className="text-[11px] text-gray-400">
          País detectado: <span className="text-gray-600">{country.flag} {country.name} ({country.dial})</span> — puedes cambiarlo arriba.
        </p>
      )}
      {national.length > 0 && (
        <p className="text-[11px] text-gray-500">
          Se enviará como: <span className="font-medium text-gray-700">{formatPhoneE164(country.dial, national)}</span>
        </p>
      )}
    </div>
  )
}
