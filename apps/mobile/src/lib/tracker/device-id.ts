import * as Application from 'expo-application'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'trackpro_device_uid'

export async function getStableDeviceUid(): Promise<string> {
  const cached = await AsyncStorage.getItem(STORAGE_KEY)
  if (cached) return cached

  let uid = ''
  if (Platform.OS === 'android') {
    uid = Application.getAndroidId() ?? ''
  } else {
    uid = (await Application.getIosIdForVendorAsync()) ?? ''
  }

  if (!uid) {
    uid = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  await AsyncStorage.setItem(STORAGE_KEY, uid)
  return uid
}

export function getPlatform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android'
}
