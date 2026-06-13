import Link from 'next/link'
import { MapPin, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Página no encontrada</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
          Esta ruta no existe o no tienes permisos para acceder a ella.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium text-sm"
        >
          <Home className="w-4 h-4" />
          Volver al dashboard
        </Link>
      </div>
    </div>
  )
}
