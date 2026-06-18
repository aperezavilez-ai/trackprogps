import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DeviceDetailClient } from '@/components/devices/device-detail-client'

export const dynamic = 'force-dynamic'

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: device } = await supabase
    .from('gps_devices')
    .select('id')
    .eq('id', params.id)
    .single()

  if (!device) notFound()

  const canCommand = ['super_admin', 'admin_empresa', 'supervisor'].includes(profile.role)
  const apiKey = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? ''

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <DeviceDetailClient deviceId={params.id} canCommand={canCommand} mapsApiKey={apiKey} />
    </div>
  )
}
