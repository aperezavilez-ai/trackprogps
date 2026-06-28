import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Headphones } from 'lucide-react'
import { canAccessSupportInbox, getSupportActor } from '@/lib/auth/support-access'
import { SupportInboxPanel } from '@/components/admin/support-inbox-panel'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { ticket?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const actor = await getSupportActor(supabase, user.id)
  if (!canAccessSupportInbox(actor)) {
    redirect('/dashboard')
  }

  const service = createSupabaseServiceClient()
  const { count: nuevoCount } = await service
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'nuevo')

  return (
    <div className="p-4 sm:p-6 max-w-7xl">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Administrador
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Headphones className="w-6 h-6 text-orange-500" />
              <h1 className="text-2xl font-semibold text-gray-900">Soporte</h1>
              {(nuevoCount ?? 0) > 0 && (
                <span className="bg-orange-500 text-white text-sm font-bold min-w-[1.75rem] h-7 px-2 rounded-full flex items-center justify-center">
                  {nuevoCount}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Consultas desde login, registro y descargar. Responde por correo desde aquí.
            </p>
          </div>
        </div>
      </div>

      <SupportInboxPanel initialTicketId={searchParams.ticket ?? null} />
    </div>
  )
}
