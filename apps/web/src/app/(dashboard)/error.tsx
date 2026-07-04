'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  function handleRetry() {
    reset()
    window.setTimeout(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('retry', String(Date.now()))
      window.location.replace(url.toString())
    }, 250)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Ocurrió un error</h2>
        <p className="text-sm text-gray-500 mb-1">{error.message || 'Error inesperado en esta página.'}</p>
        {error.digest && <p className="text-xs text-gray-400 mb-5 font-mono">{error.digest}</p>}
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    </div>
  )
}
