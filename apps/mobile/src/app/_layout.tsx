import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../stores/auth-store'
import { supabase } from '../lib/supabase'
import { validateSession } from '../lib/auth-helpers'
import { registerForPushNotifications, syncPushTokenToServer } from '../lib/notifications'

const queryClient = new QueryClient()

async function handlePostLogin() {
  const result = await validateSession()
  if (!result.ok) {
    router.replace('/login')
    return
  }
  useAuthStore.getState().setProfile({
    role:       result.profile.role,
    full_name:  result.profile.full_name,
    company_id: result.profile.company_id,
  })
  const token = await registerForPushNotifications()
  if (token) await syncPushTokenToServer(token)
  router.replace('/(tabs)/dashboard')
}

export default function RootLayout() {
  const { setUser, setSession, clear } = useAuthStore()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (event === 'SIGNED_IN') {
        await handlePostLogin()
      } else if (event === 'SIGNED_OUT') {
        clear()
        router.replace('/login')
      }
    })

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session) {
        await handlePostLogin()
      } else {
        router.replace('/login')
      }
    })

    const notifSub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/alerts')
    })

    return () => {
      subscription.unsubscribe()
      notifSub.remove()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
