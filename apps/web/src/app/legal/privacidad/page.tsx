import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { LEGAL } from '@/lib/legal/site-legal'

export const metadata = {
  title: 'Política de privacidad — TrackPro GPS',
}

export default function PrivacidadPage() {
  return (
    <LegalShell title="Política de privacidad">
      <p className="text-sm text-gray-500 mb-6">Última actualización: {LEGAL.lastUpdated}</p>

      <Section title="1. Responsable">
        <p>
          {LEGAL.brand} ({LEGAL.domain}) es responsable del tratamiento de los datos personales que
          recabamos para prestar el servicio de monitoreo vehicular GPS. Para dudas sobre privacidad
          escribe a <a href={`mailto:${LEGAL.privacyEmail}`} className="text-orange-600 hover:underline">{LEGAL.privacyEmail}</a>.
        </p>
      </Section>

      <Section title="2. Datos que recopilamos">
        <ul className="list-disc pl-5 space-y-1">
          <li>Datos de cuenta: nombre, correo, teléfono y empresa.</li>
          <li>Datos de flota: vehículos, conductores, dispositivos GPS e identificadores IMEI.</li>
          <li>Datos de ubicación: coordenadas, velocidad, rumbo e historial de recorridos.</li>
          <li>Datos técnicos: dirección IP, navegador, registros de acceso y cookies esenciales.</li>
          <li>Datos de facturación cuando contratas un plan de pago (procesados por Stripe).</li>
        </ul>
      </Section>

      <Section title="3. Finalidades">
        <ul className="list-disc pl-5 space-y-1">
          <li>Prestar el servicio de rastreo, alertas, geocercas e informes.</li>
          <li>Autenticación, soporte técnico y comunicaciones operativas.</li>
          <li>Facturación, cobranza y cumplimiento de obligaciones legales.</li>
          <li>Mejora de seguridad, prevención de fraude y continuidad del servicio.</li>
        </ul>
      </Section>

      <Section title="4. Base legal">
        <p>
          Tratamos tus datos con base en la ejecución del contrato de servicio, el consentimiento
          cuando aplique (por ejemplo, instalación de la PWA o alertas push), interés legítimo en
          seguridad operativa y obligaciones legales conforme a la LFPDPPP y su Reglamento.
        </p>
      </Section>

      <Section title="5. Compartición con terceros">
        <p>Podemos compartir datos estrictamente necesarios con:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Supabase (base de datos y autenticación).</li>
          <li>Stripe (pagos y suscripciones).</li>
          <li>Proveedores de mapas (Google Maps / OpenStreetMap) para visualización.</li>
          <li>Proveedores de infraestructura (Vercel, Fly.io) bajo acuerdos de confidencialidad.</li>
        </ul>
        <p className="mt-2">No vendemos datos personales ni ubicaciones a terceros con fines publicitarios.</p>
      </Section>

      <Section title="6. Conservación">
        <p>
          Conservamos los datos mientras mantengas una cuenta activa y el tiempo adicional necesario
          para obligaciones legales, resolución de disputas o respaldo operativo. Puedes solicitar
          eliminación sujeta a límites legales y contractuales.
        </p>
      </Section>

      <Section title="7. Derechos ARCO">
        <p>
          Puedes acceder, rectificar, cancelar u oponerte al tratamiento, así como revocar consentimiento,
          enviando solicitud a {LEGAL.privacyEmail}. Responderemos en los plazos previstos por la ley mexicana.
        </p>
      </Section>

      <Section title="8. Seguridad">
        <p>
          Aplicamos controles de acceso, cifrado en tránsito (HTTPS/TLS), segregación por empresa (multi-tenant)
          y principio de mínimo privilegio. Ningún sistema es 100% infalible; reporta incidentes a soporte.
        </p>
      </Section>

      <Section title="9. Cambios">
        <p>
          Publicaremos actualizaciones en esta página. El uso continuado del servicio después de un cambio
          material implica aceptación de la versión vigente.
        </p>
      </Section>
    </LegalShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-950 text-white px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-400" />
          <Link href="/" className="font-semibold tracking-tight">{LEGAL.brand}</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        {children}
        <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500 flex flex-wrap gap-4">
          <Link href="/legal/terminos" className="text-orange-600 hover:underline">Términos</Link>
          <Link href="/legal/aviso-legal" className="text-orange-600 hover:underline">Aviso legal</Link>
          <Link href="/login" className="text-orange-600 hover:underline">Iniciar sesión</Link>
        </div>
      </main>
    </div>
  )
}
