export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://trackprogps.mx'
}

export function getAuthCallbackUrl(nextPath: string) {
  const path = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  return `${getAppUrl()}/auth/callback?next=${encodeURIComponent(path)}`
}

export const ACTIVATE_ACCOUNT_PATH = '/activar-cuenta'
export const RESET_PASSWORD_PATH = '/reset-password'
