import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { LEGAL } from '@/lib/legal/site-legal'

export const metadata = {
  title: 'Aviso legal — TrackPro GPS',
}

export default function AvisoLegalPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-950 text-white px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-400" />
          <Link href="/" className="font-semibold tracking-tight">{LEGAL.brand}</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Aviso legal</h1>
        <p className="text-sm text-gray-500 mb-6">Última actualización: {LEGAL.lastUpdated}</p>

        <div className="text-sm text-gray-600 leading-relaxed space-y-4">
          <p>
            En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
            y demás normativa aplicable en México, se informa que el sitio {LEGAL.domain} y la plataforma{' '}
            {LEGAL.brand} son operados con fines comerciales de software como servicio (SaaS) para monitoreo vehicular.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Titular del servicio</h2>
            <p>
              Denominación comercial: <strong>{LEGAL.brand}</strong><br />
              Sitio web: <a href={`https://${LEGAL.domain}`} className="text-orange-600 hover:underline">https://{LEGAL.domain}</a><br />
              Correo de contacto: <a href={`mailto:${LEGAL.contactEmail}`} className="text-orange-600 hover:underline">{LEGAL.contactEmail}</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Objeto</h2>
            <p>
              Este aviso regula el acceso y uso del portal web, panel de administración, aplicación móvil/PWA
              y APIs asociadas al servicio de rastreo GPS en tiempo real.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Propiedad intelectual</h2>
            <p>
              Los contenidos, logotipos, código, bases de datos y documentación están protegidos por derechos
              de autor y tratados internacionales. Queda prohibida su reproducción no autorizada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Enlaces externos</h2>
            <p>
              El servicio puede enlazar a sitios de terceros (mapas, pagos, documentación). No nos hacemos
              responsables de sus políticas ni contenidos.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500 flex flex-wrap gap-4">
          <Link href="/legal/privacidad" className="text-orange-600 hover:underline">Privacidad</Link>
          <Link href="/legal/terminos" className="text-orange-600 hover:underline">Términos</Link>
          <Link href="/login" className="text-orange-600 hover:underline">Iniciar sesión</Link>
        </div>
      </main>
    </div>
  )
}
