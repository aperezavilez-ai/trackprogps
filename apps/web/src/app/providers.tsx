'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { PwaRegistrar } from '@/components/pwa/pwa-registrar'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:  60 * 1000, // 1 minute
            gcTime:     5 * 60 * 1000, // 5 minutes
            retry:      1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <PwaRegistrar />
      {children}
    </QueryClientProvider>
  )
}
