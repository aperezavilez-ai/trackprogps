import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  ACTIVATE_ACCOUNT_PATH,
  RESET_PASSWORD_PATH,
  getAuthCallbackUrl,
} from '@/lib/auth/access-links'
import {
  sendActivationReminderEmail,
  sendPasswordResetEmail,
} from '@/lib/email/send-invitation'
import { z } from 'zod'

const BodySchema = z.object({
  type: z.enum(['activation', 'reset']),
})

const MANAGEABLE_ROLES = ['super_admin', 'admin_empresa'] as const

async function getActor(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data } = await supabase.from('users').select('id, company_id, role').eq('id', userId).single()
  return data
}

async function getTarget(service: ReturnType<typeof createSupabaseServiceClient>, targetId: string) {
  const { data } = await service
    .from('users')
    .select('id, company_id, role, email, last_sign_in_at, company:companies(name)')
    .eq('id', targetId)
    .single()
  return data
}

function canManage(actor: { role: string; company_id: string | null }, target: { company_id: string | null }) {
  if (actor.role === 'super_admin') return true
  if (actor.role === 'admin_empresa') return target.company_id === actor.company_id
  return false
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const actor = await getActor(supabase, user.id)
  if (!actor || !MANAGEABLE_ROLES.includes(actor.role as typeof MANAGEABLE_ROLES[number])) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  if (params.id === user.id) {
    return NextResponse.json({ error: 'Usa Olvidé mi contraseña para tu propia cuenta' }, { status: 422 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Tipo inválido (activation | reset)' }, { status: 422 })
  }

  const service = createSupabaseServiceClient()
  const target = await getTarget(service, params.id)
  if (!target?.email) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (!canManage(actor, target)) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })

  const { type } = parsed.data
  const companyName = (target.company as { name: string } | null)?.name ?? 'TrackPro GPS'

  if (type === 'activation') {
    const redirectTo = getAuthCallbackUrl(ACTIVATE_ACCOUNT_PATH)
    const { data: linkData, error } = await service.auth.admin.generateLink({
      type: 'invite',
      email: target.email,
      options: { redirectTo },
    })

    if (error) {
      const { data: magicData, error: magicError } = await service.auth.admin.generateLink({
        type: 'magiclink',
        email: target.email,
        options: { redirectTo },
      })
      if (magicError) {
        return NextResponse.json({ error: magicError.message }, { status: 500 })
      }
      const activateUrl = magicData?.properties?.action_link
      if (!activateUrl) {
        return NextResponse.json({ error: 'No se pudo generar enlace' }, { status: 500 })
      }
      const emailSent = await sendActivationReminderEmail({
        to: target.email,
        companyName,
        activateUrl,
      })
      return NextResponse.json({
        success: true,
        message: emailSent
          ? `Correo de activación reenviado a ${target.email}`
          : `Enlace generado pero el correo no se envió (revisa Resend)`,
        email_sent: emailSent,
      })
    }

    const activateUrl = linkData?.properties?.action_link
    if (!activateUrl) {
      return NextResponse.json({ error: 'No se pudo generar enlace' }, { status: 500 })
    }

    const emailSent = await sendActivationReminderEmail({
      to: target.email,
      companyName,
      activateUrl,
    })

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Correo de activación reenviado a ${target.email}`
        : `Enlace generado pero el correo no se envió (revisa Resend)`,
      email_sent: emailSent,
    })
  }

  const redirectTo = getAuthCallbackUrl(RESET_PASSWORD_PATH)
  const { data: linkData, error } = await service.auth.admin.generateLink({
    type: 'recovery',
    email: target.email,
    options: { redirectTo },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const resetUrl = linkData?.properties?.action_link
  if (!resetUrl) {
    return NextResponse.json({ error: 'No se pudo generar enlace' }, { status: 500 })
  }

  const emailSent = await sendPasswordResetEmail({
    to: target.email,
    resetUrl,
    context: 'admin',
  })

  return NextResponse.json({
    success: true,
    message: emailSent
      ? `Correo de restablecimiento enviado a ${target.email}`
      : `Enlace generado pero el correo no se envió (revisa Resend)`,
    email_sent: emailSent,
  })
}
