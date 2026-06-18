import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import DescargarPageClient from './page-client'

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <DescargarPageClient />
    </Suspense>
  )
}
