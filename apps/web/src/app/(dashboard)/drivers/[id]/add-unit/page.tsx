import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { InstallationWizard } from '@/components/fleet/installation-wizard'

export const dynamic = 'force-dynamic'

export default async function AddUnitPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, full_name')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (!driver) notFound()

  return (
    <InstallationWizard
      mode="add-unit"
      driverId={driver.id}
      driverName={driver.full_name}
    />
  )
}
