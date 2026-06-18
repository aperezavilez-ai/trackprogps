import { InstallationWizard } from '@/components/fleet/installation-wizard'

export const dynamic = 'force-dynamic'

export default function NewInstallationPage() {
  return <InstallationWizard mode="full" />
}
