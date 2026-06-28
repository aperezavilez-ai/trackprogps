import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UsersAdminPanel } from '@/components/admin/users-admin-panel'
import { Building2, UserPlus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const isSuperAdmin = profile.role === 'super_admin'

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Administrador</h1>
          <p className="text-sm text-gray-500 mt-1">
            Equipo interno de TrackPro GPS — no incluye clientes (ellos se registran en /register)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <a
            href="#alta-usuario"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition"
          >
            <UserPlus className="w-4 h-4" />
            Dar de alta usuario
          </a>
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
            >
              <Building2 className="w-4 h-4" />
              Empresas
            </Link>
          )}
        </div>
      </div>
      <UsersAdminPanel
        currentUserId={user.id}
        isSuperAdmin={isSuperAdmin}
        variant={isSuperAdmin ? 'platform' : 'company'}
      />
    </div>
  )
}
