import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const InviteSchema = z.object({
  email: z.string().email(),
  role:  z.enum(['admin_empresa','supervisor','operador','cliente_consulta']),
})

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const serviceClient = createSupabaseServiceClient()

  // Use Supabase admin to invite user via email
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      company_id: profile.company_id,
      role:       parsed.data.role,
    },
    redirectTo: `${process.env['NEXT_PUBLIC_APP_URL']}/login`,
  })

  if (error) {
    if (error.message.includes('already registered')) {
      // User exists: add to this company
      const { data: existingUser } = await serviceClient.auth.admin.listUsers()
      const existing = existingUser.users.find(u => u.email === parsed.data.email)
      if (existing) {
        await serviceClient.from('users').update({
          company_id: profile.company_id,
          role:       parsed.data.role,
        }).eq('id', existing.id)
        return NextResponse.json({ success: true, message: 'User added to company' })
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: `Invitation sent to ${parsed.data.email}` }, { status: 201 })
}
