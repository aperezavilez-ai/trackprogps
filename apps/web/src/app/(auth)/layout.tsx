export const dynamic = 'force-dynamic'

import { SupportContactProvider } from '@/components/support/support-contact-provider'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SupportContactProvider>{children}</SupportContactProvider>
}
