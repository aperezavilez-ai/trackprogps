import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native'
import { supabase } from '../lib/supabase'
import { validateSession } from '../lib/auth-helpers'
import { registerForPushNotifications, syncPushTokenToServer } from '../lib/notifications'
import { useAuthStore } from '../stores/auth-store'
import { Ionicons } from '@expo/vector-icons'

const ERROR_MESSAGES: Record<string, string> = {
  unconfirmed: 'Confirma tu correo antes de ingresar. Revisa tu bandeja.',
  inactive:    'Tu cuenta está desactivada. Contacta al administrador.',
  no_profile:  'Perfil de usuario no encontrado.',
}

export default function LoginScreen() {
  const setProfile = useAuthStore(s => s.setProfile)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Error', 'Ingresa tu correo y contraseña'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      Alert.alert('Error de acceso', error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos'
        : error.message)
      return
    }

    const result = await validateSession()
    setLoading(false)
    if (!result.ok) {
      Alert.alert('Acceso denegado', ERROR_MESSAGES[result.reason] ?? 'No puedes ingresar')
      return
    }

    setProfile({
      role:       result.profile.role,
      full_name:  result.profile.full_name,
      company_id: result.profile.company_id,
    })

    const pushToken = await registerForPushNotifications()
    if (pushToken) await syncPushTokenToServer(pushToken)
    // Navigation handled by auth listener
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="location" size={28} color="#fff" />
          </View>
          <Text style={styles.logoText}>TrackPro</Text>
          <Text style={styles.logoSub}>Monitoreo vehicular</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Iniciar sesión</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@empresa.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPwd(!showPwd)}>
                <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.buttonText}>Ingresar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E3A5F' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 64, height: 64, backgroundColor: '#3B82F6',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  logoSub:  { fontSize: 14, color: '#93C5FD', marginTop: 4 },
  form: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  formTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 20 },
  fieldContainer: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14,
    color: '#111827', backgroundColor: '#F9FAFB',
  },
  passwordContainer: { position: 'relative' },
  passwordInput:     { paddingRight: 48 },
  eyeButton: {
    position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center',
  },
  button: {
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
