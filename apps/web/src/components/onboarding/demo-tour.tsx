'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, X, MapIcon, Truck, AlertTriangle, MapPin, BarChart2, CreditCard } from 'lucide-react'

const TOUR_KEY = 'trackpro_demo_tour_v1'

const STEPS = [
  {
    icon: MapIcon,
    title: 'Mapa en vivo',
    description: 'Ubica tu flota en tiempo real, filtra por grupo y revisa velocidad, encendido y última posición de cada unidad.',
    href: '/map',
  },
  {
    icon: Truck,
    title: 'Vehículos y dispositivos',
    description: 'Administra unidades, asigna GPS Teltonika y consulta el estado de conexión de cada dispositivo.',
    href: '/vehicles',
  },
  {
    icon: AlertTriangle,
    title: 'Alertas inteligentes',
    description: 'Recibe avisos por exceso de velocidad, geocercas, SOS, corte de corriente y más — por correo o push.',
    href: '/alerts',
  },
  {
    icon: MapPin,
    title: 'Geocercas',
    description: 'Dibuja zonas en el mapa y entérate cuando un vehículo entra o sale de un área importante.',
    href: '/geofences',
  },
  {
    icon: BarChart2,
    title: 'Reportes e historial',
    description: 'Consulta recorridos, kilometraje, productividad y exporta reportes para tu operación.',
    href: '/reports',
  },
  {
    icon: CreditCard,
    title: 'Elige tu plan',
    description: 'Cuando veas lo que necesitas, contrata el plan que mejor se adapte a tu flota. Sin sorpresas.',
    href: '/billing?tab=suscripcion',
    cta: true,
  },
]

export function DemoTour({ forceStart = false }: { forceStart?: boolean }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const wantsTour = forceStart || searchParams.get('demo_tour') === '1'
    const done = localStorage.getItem(TOUR_KEY) === '1'
    if (wantsTour && !done) {
      setOpen(true)
      setStep(0)
    }
  }, [forceStart, searchParams])

  function close(save = true) {
    if (save) localStorage.setItem(TOUR_KEY, '1')
    setOpen(false)
    if (searchParams.get('demo_tour') === '1') {
      router.replace('/dashboard')
    }
  }

  if (!open) return null

  const current = STEPS[step]!
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-xs font-medium">Recorrido guiado</p>
            <p className="text-white font-semibold">Paso {step + 1} de {STEPS.length}</p>
          </div>
          <button type="button" onClick={() => close(true)} className="text-white/80 hover:text-white" aria-label="Cerrar tour">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{current.title}</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">{current.description}</p>

          <div className="flex gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-orange-500' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => close(true)}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Saltar tour
            </button>
            <div className="flex-1" />
            {isLast ? (
              <Link
                href={current.href}
                onClick={() => close(true)}
                className="inline-flex items-center gap-1 px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400"
              >
                Ver planes
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (current.href && step < STEPS.length - 2) {
                    router.push(current.href)
                  }
                  setStep(s => Math.min(s + 1, STEPS.length - 1))
                }}
                className="inline-flex items-center gap-1 px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
