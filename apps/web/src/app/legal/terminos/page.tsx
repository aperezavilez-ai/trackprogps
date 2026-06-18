import Link from 'next/link'
import { LEGAL } from '@/lib/legal/site-legal'
import { TrackProLogo } from '@/components/brand/trackpro-logo'

export const metadata = {
  title: 'Términos y condiciones — TrackPro GPS',
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-950 text-white px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
        <Link href="/">
          <TrackProLogo size="sm" />
        </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Términos y condiciones de uso</h1>
        <p className="text-sm text-gray-500 mb-6">Última actualización: {LEGAL.lastUpdated}</p>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Aceptación</h2>
          <p>
            Al registrarte, instalar la aplicación o usar {LEGAL.brand}, aceptas estos términos y nuestra{' '}
            <Link href="/legal/privacidad" className="text-orange-600 hover:underline">Política de privacidad</Link>.
            Si actúas en nombre de una empresa, declaras tener facultad para obligarla.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Servicio</h2>
          <p>
            {LEGAL.brand} ofrece monitoreo GPS de vehículos, mapas en tiempo real, alertas, geocercas,
            historial de rutas e informes. La disponibilidad depende de cobertura celular del dispositivo,
            configuración correcta del hardware y mantenimiento de la plataforma.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Cuenta y prueba gratuita</h2>
          <p>
            El registro puede incluir un período de prueba de 14 días según el plan contratado. Eres
            responsable de la confidencialidad de tus credenciales y del uso de tu cuenta por tu personal autorizado.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Planes y pagos</h2>
          <p>
            Los precios publicados están en pesos mexicanos (MXN) salvo indicación contraria. Los pagos
            recurrentes se procesan mediante Stripe. El incumplimiento de pago puede suspender el acceso
            sin responsabilidad por pérdida de datos históricos más allá de los plazos de retención informados.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Uso permitido</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Monitorear vehículos de tu propiedad o con consentimiento del titular/conductor.</li>
            <li>Cumplir leyes de protección de datos, laborales y de telecomunicaciones aplicables.</li>
            <li>No usar el servicio para vigilancia ilícita, acoso o fines contrarios a la ley.</li>
            <li>No intentar vulnerar, escanear o sobrecargar la plataforma.</li>
          </ul>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Limitación de responsabilidad</h2>
          <p>
            El servicio se proporciona &quot;tal cual&quot;. No garantizamos precisión absoluta de ubicación,
            continuidad ininterrumpida ni ausencia de errores. {LEGAL.brand} no será responsable por daños
            indirectos, lucro cesante o incidentes derivados del uso de la información de rastreo.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Propiedad intelectual</h2>
          <p>
            El software, marca, diseño e interfaces son propiedad de {LEGAL.brand} o sus licenciantes.
            Se te otorga una licencia limitada, no exclusiva e intransferible durante la vigencia de tu suscripción.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Terminación</h2>
          <p>
            Puedes cancelar tu suscripción conforme a las opciones de facturación. Podemos suspender o
            terminar cuentas por incumplimiento grave, fraude o riesgo de seguridad, previo aviso cuando sea razonable.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Ley aplicable</h2>
          <p>
            Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Las controversias
            se someterán a los tribunales competentes de la Ciudad de México, salvo disposición imperativa en contrario.
          </p>
        </section>

        <section className="mb-6 text-sm text-gray-600 leading-relaxed">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Contacto</h2>
          <p>
            {LEGAL.supportEmail} · {LEGAL.contactEmail}
          </p>
        </section>

        <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500 flex flex-wrap gap-4">
          <Link href="/legal/privacidad" className="text-orange-600 hover:underline">Privacidad</Link>
          <Link href="/legal/aviso-legal" className="text-orange-600 hover:underline">Aviso legal</Link>
          <Link href="/register" className="text-orange-600 hover:underline">Registrarse</Link>
        </div>
      </main>
    </div>
  )
}
