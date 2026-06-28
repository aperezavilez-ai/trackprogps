'use client'

import Link from 'next/link'
import { LEGAL } from '@/lib/legal/site-legal'
import { useSupportContact } from '@/components/support/support-contact-provider'

interface Props {
  variant?: 'dark' | 'light'
  supportSource?: 'login' | 'register' | 'descargar'
}

export function AuthLegalFooter({ variant = 'dark', supportSource = 'login' }: Props) {
  const { openSupport } = useSupportContact()
  const isDark = variant === 'dark'
  const text = isDark ? 'text-white/55' : 'text-gray-500'
  const link = isDark ? 'text-white/50 hover:text-white/80' : 'text-gray-500 hover:text-gray-800'
  const border = isDark ? 'border-white/10' : 'border-gray-200'

  return (
    <footer className={`mt-6 pt-5 border-t ${border} flex flex-col md:flex-row md:items-end justify-between gap-4`}>
      <div className="space-y-2">
        <p className={`text-[11px] ${text}`}>
          Copyright © {new Date().getFullYear()} {LEGAL.brand}. Todos los derechos reservados.
        </p>
        <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${link}`}>
          <Link href="/legal/privacidad">Política de privacidad</Link>
          <Link href="/legal/terminos">Términos y condiciones</Link>
          <Link href="/legal/aviso-legal">Aviso legal</Link>
          <button
            type="button"
            onClick={() => openSupport(supportSource)}
            className={`hover:underline ${isDark ? 'text-white/50 hover:text-white/80' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Soporte
          </button>
        </div>
      </div>
      <p className={`text-[11px] ${text} md:text-right`}>
        Servicio operado desde México · {LEGAL.domain}
      </p>
    </footer>
  )
}
