import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user:       User | null
  session:    Session | null
  profile:    { role: string; full_name: string; company_id: string | null } | null
  setUser:    (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: AuthState['profile']) => void
  clear:      () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user:       null,
  session:    null,
  profile:    null,
  setUser:    (user)    => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  clear:      ()        => set({ user: null, session: null, profile: null }),
}))
