import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RegisterSchema = z.object({
  companyName:  z.string().min(2).max(150),
  companyEmail: z.string().email(),
  companyPhone: z.string().optional(),
  fullName:     z.string().min(2).max(150),
  email:        z.string().email(),
  password:     z.string().min(8),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const { companyName, companyEmail, companyPhone, fullName, email, password } = parsed.data
  const supabase = createSupabaseServiceClient()

  // 1. Get default plan (Básico)
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('type', 'basico')
    .eq('is_active', true)
    .single()

  if (!plan) return NextResponse.json({ error: 'No se encontró plan disponible' }, { status: 500 })

  // 2. Create company
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name:          companyName,
      email:         companyEmail,
      phone:         companyPhone ?? null,
      plan_id:       plan.id,
      status:        'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .select('id')
    .single()

  if (companyError) {
    return NextResponse.json({ error: 'Error al crear empresa: ' + companyError.message }, { status: 500 })
  }

  // 3. Create subscription record
  await supabase.from('subscriptions').insert({
    company_id:            company.id,
    plan_id:               plan.id,
    status:                'trialing',
    current_period_start:  new Date().toISOString(),
    current_period_end:    trialEndsAt.toISOString(),
  })

  // 4. Create auth user with company_id in metadata
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // require email confirmation
    user_metadata: {
      full_name:  fullName,
      company_id: company.id,
      role:       'admin_empresa',
    },
  })

  if (authError) {
    // Rollback company creation
    await supabase.from('companies').delete().eq('id', company.id)
    return NextResponse.json({ error: 'Error al crear usuario: ' + authError.message }, { status: 500 })
  }

  // 5. Update users table (trigger should handle this, but ensure it's correct)
  await supabase
    .from('users')
    .update({ role: 'admin_empresa', company_id: company.id })
    .eq('id', authUser.user.id)

  return NextResponse.json({ success: true, company_id: company.id }, { status: 201 })
}
