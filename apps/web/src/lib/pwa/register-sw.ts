export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    return reg
  } catch {
    return null
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
  const displayModeStandalone = displayModes.some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)

  return displayModeStandalone
    || navigatorWithStandalone.standalone === true
}

export function markPwaDisplayMode() {
  if (typeof window === 'undefined') return
  document.documentElement.dataset.trackproPwa = isStandalonePwa() ? 'standalone' : 'browser'
}
