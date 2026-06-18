import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { setUserGroupAccess } from '@/lib/auth/group-access'
import { sendInvitationEmail } from '@/lib/email/send-invitation'
import { z } from 'zod'

const InviteSchema = z.object({
  email:      z.string().email(),
  role:       z.enum(['super_admin', 'admin_empresa', 'supervisor', 'operador', 'cliente_consulta', 'miembro_familiar']),
  company_id: z.string().uuid().nullable().optional(),
  group_ids:  z.array(z.string().uuid()).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role, full_name, company:companies(name)')
    .eq('id', user.id)
    .single()
  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const isSuper = profile.role === 'super_admin'
  let targetCompanyId = profile.company_id

  if (parsed.data.role === 'super_admin') {
    if (!isSuper) return NextResponse.json({ error: 'Solo Super Admin puede crear Super Admins' }, { status: 403 })
    targetCompanyId = null
  } else if (isSuper && parsed.data.company_id !== undefined) {
    targetCompanyId = parsed.data.company_id
  } else if (!targetCompanyId && parsed.data.role !== 'super_admin') {
    return NextResponse.json({ error: 'Selecciona una empresa para este usuario' }, { status: 422 })
  }

  const serviceClient = createSupabaseServiceClient()

  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      company_id: targetCompanyId,
      role:       parsed.data.role,
    },
    redirectTo: `${process.env['NEXT_PUBLIC_APP_URL']}/auth/callback?next=/login?confirmed=1`,
  })

  if (error) {
    if (error.message.includes('already registered')) {
      const { data: existingUser } = await serviceClient.auth.admin.listUsers()
      const existing = existingUser.users.find(u => u.email === parsed.data.email)
      if (existing) {
        await serviceClient.from('users').update({
          company_id: targetCompanyId,
          role:       parsed.data.role,
          is_active:  true,
        }).eq('id', existing.id)

        if (parsed.data.group_ids?.length && targetCompanyId) {
          await setUserGroupAccess(serviceClient, existing.id, targetCompanyId, parsed.data.group_ids)
        } else if (targetCompanyId) {
          await serviceClient.from('user_vehicle_group_access').delete().eq('user_id', existing.id)
        }

        return NextResponse.json({ success: true, message: 'User added to company' })
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const invitedUserId = data.user?.id
  if (invitedUserId && parsed.data.group_ids?.length && targetCompanyId) {
    await setUserGroupAccess(serviceClient, invitedUserId, targetCompanyId, parsed.data.group_ids)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trackprogps.mx'
  const companyName = (profile.company as { name: string } | null)?.name ?? 'TrackPro GPS'
  const { data: linkData } = await serviceClient.auth.admin.generateLink({
    type: 'invite',
    email: parsed.data.email,
    options: { redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/login?confirmed=1')}` },
  })
  const inviteUrl = linkData?.properties?.action_link ?? `${appUrl}/login`
  await sendInvitationEmail({
    to: parsed.data.email,
    companyName,
    invitedBy: profile.full_name ?? 'Administrador',
    role: parsed.data.role,
    inviteUrl,
  })

  return NextResponse.json({ success: true, message: `Invitation sent to ${parsed.data.email}` }, { status: 201 })
}
