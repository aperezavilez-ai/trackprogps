import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CompanyUpdateSchema = z.object({
  name:    z.string().min(2).max(150),
  rfc:     z.string().max(15).nullable().optional(),
  phone:   z.string().max(20).nullable().optional(),
  email:   z.string().email(),
  address: z.string().max(500).nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = CompanyUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('companies')
    .update(parsed.data)
    .eq('id', profile.company_id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
