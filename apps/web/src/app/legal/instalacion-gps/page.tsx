import Link from 'next/link'
import { LEGAL } from '@/lib/legal/site-legal'
import { SIM_DEVICE_TERMS_PARAGRAPH, INSTALLER_GUIDE_SECTIONS } from '@/lib/legal/gps-installation'
import { TrackProLogo } from '@/components/brand/trackpro-logo'
import { PrintPageButton } from '@/components/legal/print-page-button'

export const metadata = {
  title: 'Instalación GPS, SIM y responsabilidades — TrackPro GPS',
  description: 'Guía para instaladores y cláusula de responsabilidad sobre SIM y dispositivos GPS.',
}

export default function InstalacionGpsPage() {
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="bg-slate-950 text-white px-4 py-5 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link href="/">
            <TrackProLogo size="sm" />
          </Link>
          <PrintPageButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 print:py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Instalación GPS, SIM y dispositivos
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Guía para instaladores · Cláusula contractual · {LEGAL.lastUpdated}
        </p>

        <section className="mb-8 bg-white border border-gray-200 rounded-2xl p-6 print:border print:rounded-none">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Cláusula — Términos y condiciones (SIM y dispositivos)
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed text-justify">
            {SIM_DEVICE_TERMS_PARAGRAPH}
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Este párrafo forma parte de los{' '}
            <Link href="/legal/terminos" className="text-orange-600 hover:underline">
              Términos y condiciones
            </Link>{' '}
            de {LEGAL.brand}.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Guía rápida para instaladores (1 página)
          </h2>
          <div className="space-y-5">
            {INSTALLER_GUIDE_SECTIONS.map(section => (
              <div key={section.title} className="bg-white border border-gray-200 rounded-xl p-5 print:break-inside-avoid">
                <h3 className="text-sm font-semibold text-orange-600 mb-2">{section.title}</h3>
                <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
                  {section.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="text-sm text-gray-600 border-t border-gray-200 pt-6 print:mt-4">
          <p>
            <strong>Soporte técnico:</strong>{' '}
            <a href={`mailto:${LEGAL.supportEmail}`} className="text-orange-600 hover:underline">
              {LEGAL.supportEmail}
            </a>
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Documento informativo. No sustituye asesoría legal. Verifica normativa CRT/IFT vigente.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-4 text-sm print:hidden">
          <Link href="/legal/terminos" className="text-orange-600 hover:underline">Términos</Link>
          <Link href="/legal/privacidad" className="text-orange-600 hover:underline">Privacidad</Link>
          <Link href="/login" className="text-orange-600 hover:underline">Iniciar sesión</Link>
        </div>
      </main>
    </div>
  )
}
