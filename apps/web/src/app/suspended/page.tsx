import Link from 'next/link'
import { AlertTriangle, CreditCard, LogOut } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function SuspendedPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user ? await supabase
    .from('users')
    .select('company:companies(name, email)')
    .eq('id', user.id)
    .single() : { data: null }

  const company = (profile?.company as { name: string; email: string } | null)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso limitado</h1>
          {company && (
            <p className="text-gray-500 text-sm mb-1">{company.name}</p>
          )}
          <p className="text-gray-500 text-sm mb-6">
            Tu prueba gratuita terminó o la cuenta está suspendida. Contrata un plan para reactivar mapa, alertas e historial.
          </p>

          <div className="space-y-3">
            <Link href="/billing?trial_expired=1&tab=suscripcion"
              className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium text-sm">
              <CreditCard className="w-4 h-4" />
              Elegir plan y pagar
            </Link>

            <p className="text-sm text-gray-400">
              ¿Tienes preguntas? Escríbenos a{' '}
              <a href="mailto:alertas@trackprogps.mx" className="text-orange-500 hover:underline">
                alertas@trackprogps.mx
              </a>
            </p>

            <div className="pt-2 border-t border-gray-100">
              <form action="/api/auth/signout" method="POST">
                <button type="submit"
                  className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 hover:text-gray-700 py-2">
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
