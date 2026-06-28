import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { setUserGroupAccess } from '@/lib/auth/group-access'
import { sendInvitationEmail } from '@/lib/email/send-invitation'
import { ensurePlatformInternalCompany, isInternalTeamRole } from '@/lib/auth/platform-team'
import { ACTIVATE_ACCOUNT_PATH, getAuthCallbackUrl } from '@/lib/auth/access-links'
import { z } from 'zod'

const InviteSchema = z.object({
  email:      z.string().email('Correo inválido'),
  role:       z.enum(['super_admin', 'admin_empresa', 'supervisor', 'operador', 'cliente_consulta', 'miembro_familiar']),
  company_id: z.string().uuid().nullable().optional(),
  group_ids:  z.array(z.string().uuid()).optional(),
  /** internal = equipo TrackPro; company = staff de una empresa cliente (admin_empresa) */
  scope:      z.enum(['internal', 'company']).optional(),
})

async function findAuthUserByEmail(
  serviceClient: ReturnType<typeof createSupabaseServiceClient>,
  email: string,
) {
  let page = 1
  const perPage = 200
  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < perPage) break
    page += 1
  }
  return null
}

async function upsertInvitedProfile(
  serviceClient: ReturnType<typeof createSupabaseServiceClient>,
  opts: { id: string; email: string; role: string; companyId: string | null },
) {
  const { error } = await serviceClient.from('users').upsert({
    id: opts.id,
    email: opts.email,
    full_name: opts.email.split('@')[0] ?? opts.email,
    role: opts.role,
    company_id: opts.companyId,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (error) throw error
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role, full_name, company:companies(name)')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })
  }

  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.email?.[0]
      ?? parsed.error.flatten().fieldErrors.company_id?.[0]
      ?? 'Datos inválidos'
    return NextResponse.json({ error: msg, details: parsed.error.flatten() }, { status: 422 })
  }

  const isSuper = profile.role === 'super_admin'
  const { email, role, group_ids } = parsed.data
  const scope = parsed.data.scope ?? (isSuper ? 'internal' : 'company')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Servidor sin configurar (SERVICE_ROLE_KEY)' }, { status: 500 })
  }

  const serviceClient = createSupabaseServiceClient()
  let targetCompanyId: string | null = profile.company_id

  if (scope === 'internal') {
    if (!isSuper) {
      return NextResponse.json({ error: 'Solo el dueño de plataforma puede dar de alta equipo interno' }, { status: 403 })
    }
    if (!isInternalTeamRole(role)) {
      return NextResponse.json({ error: 'Rol no válido para equipo interno' }, { status: 422 })
    }
    if (role === 'super_admin') {
      targetCompanyId = null
    } else {
      targetCompanyId = await ensurePlatformInternalCompany(serviceClient)
    }
  } else if (role === 'super_admin') {
    if (!isSuper) {
      return NextResponse.json({ error: 'Solo el dueño de plataforma puede crear super admins' }, { status: 403 })
    }
    targetCompanyId = null
  } else if (isSuper && parsed.data.company_id) {
    targetCompanyId = parsed.data.company_id
  } else if (!targetCompanyId) {
    return NextResponse.json({ error: 'Tu cuenta no tiene empresa asignada' }, { status: 422 })
  }
  const redirectTo = getAuthCallbackUrl(ACTIVATE_ACCOUNT_PATH)

  let invitedUserId: string | null = null
  let alreadyRegistered = false

  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: {
      company_id: targetCompanyId,
      role,
      full_name: email.split('@')[0],
    },
    redirectTo,
  })

  if (inviteError) {
    const msg = inviteError.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('duplicate')) {
      alreadyRegistered = true
      const existing = await findAuthUserByEmail(serviceClient, email)
      if (!existing) {
        return NextResponse.json({
          error: 'El correo ya está registrado pero no se pudo vincular. Contacta soporte.',
        }, { status: 409 })
      }
      invitedUserId = existing.id
    } else {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }
  } else {
    invitedUserId = inviteData.user?.id ?? null
  }

  if (!invitedUserId) {
    return NextResponse.json({ error: 'No se pudo crear la invitación' }, { status: 500 })
  }

  try {
    await upsertInvitedProfile(serviceClient, {
      id: invitedUserId,
      email,
      role,
      companyId: targetCompanyId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al guardar perfil'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (group_ids?.length && targetCompanyId) {
    await setUserGroupAccess(serviceClient, invitedUserId, targetCompanyId, group_ids)
  } else if (targetCompanyId) {
    await serviceClient.from('user_vehicle_group_access').delete().eq('user_id', invitedUserId)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trackprogps.mx'
  let inviteUrl = `${appUrl}${ACTIVATE_ACCOUNT_PATH}`
  const { data: linkData } = await serviceClient.auth.admin.generateLink({
    type: alreadyRegistered ? 'magiclink' : 'invite',
    email,
    options: { redirectTo },
  })
  inviteUrl = linkData?.properties?.action_link ?? inviteUrl

  const { data: targetCompany } = targetCompanyId
    ? await serviceClient.from('companies').select('name').eq('id', targetCompanyId).maybeSingle()
    : { data: null }

  const companyName = scope === 'internal'
    ? 'TrackPro GPS'
    : (targetCompany?.name
      ?? (profile.company as { name: string } | null)?.name
      ?? 'TrackPro GPS')

  const emailSent = await sendInvitationEmail({
    to: email,
    companyName,
    invitedBy: profile.full_name ?? 'Administrador',
    role,
    inviteUrl,
  })

  return NextResponse.json({
    success: true,
    message: alreadyRegistered
      ? `Usuario ${email} actualizado en ${companyName}${emailSent ? '. Se envió correo de acceso.' : ''}`
      : `Invitación enviada a ${email}${emailSent ? '' : ' (correo no enviado — revisa Resend)'}`,
    email_sent: emailSent,
  }, { status: 201 })
}
