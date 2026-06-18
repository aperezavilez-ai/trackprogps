/** Remitentes Resend — dominio verificado: trackprogps.mx */
export function resendFromAlerts(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'alertas@trackprogps.mx'
}

export function resendFromNoreply(): string {
  return process.env.RESEND_FROM_NOREPLY ?? 'noreply@trackprogps.mx'
}

export function resendFromBilling(): string {
  return process.env.RESEND_FROM_BILLING ?? 'facturacion@trackprogps.mx'
}
