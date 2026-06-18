import Link from 'next/link'
import { Home } from 'lucide-react'
import { TrackProLogo } from '@/components/brand/trackpro-logo'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <TrackProLogo size="md" theme="light" className="inline-flex mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Página no encontrada</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
          Esta ruta no existe o no tienes permisos para acceder a ella.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-medium text-sm"
          >
            <Home className="w-4 h-4" />
            Ir al dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-xl font-medium text-sm"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
