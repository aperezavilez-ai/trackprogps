import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { resolvePlanId } from '@/lib/billing/resolve-plan'
import { resendFromNoreply } from '@/lib/email/resend-from'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit'
import { z } from 'zod'

const RegisterSchema = z.object({
  accountType:  z.enum(['personal', 'family', 'business']).default('business'),
  companyName:  z.string().min(2).max(150),
  companyEmail: z.string().email(),
  companyPhone: z.string().optional(),
  fullName:     z.string().min(2).max(150),
  email:        z.string().email(),
  password:     z.string().min(8),
  planId:       z.string().optional(),
  billingPeriod: z.enum(['monthly', 'yearly']).optional(),
})

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const body = await request.json()
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const { accountType, companyName, companyEmail, companyPhone, fullName, email, password, planId, billingPeriod } = parsed.data
  const supabase = createSupabaseServiceClient()

  // 1. Plan según tipo de cuenta (Modelo C híbrido)
  const planTypeByAccount: Record<string, string> = {
    personal: 'personal_mobile',
    family: 'familia_mobile',
    business: 'basico',
  }
  const planType = planTypeByAccount[accountType] ?? 'basico'

  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('type', planType)
    .eq('is_active', true)
    .maybeSingle()

  const { data: fallbackPlan } = plan
    ? { data: plan }
    : await supabase
        .from('plans')
        .select('id')
        .eq('type', 'basico')
        .eq('is_active', true)
        .single()

  const selectedPlan = plan ?? fallbackPlan
  if (!selectedPlan) return NextResponse.json({ error: 'No se encontró plan disponible' }, { status: 500 })

  // 2. Create company — modo demostración (sin trial)
  const settings: Record<string, unknown> = {
    notification_email: companyEmail,
    demo_tour: true,
  }
  if (email.toLowerCase() !== companyEmail.toLowerCase()) {
    settings['notification_email_secondary'] = email
  }
  let resolvedPlanId: string | null = null
  if (planId) {
    resolvedPlanId = await resolvePlanId(supabase, planId)
    if (resolvedPlanId) {
      settings['pending_checkout'] = {
        plan_id: resolvedPlanId,
        billing_period: billingPeriod ?? 'monthly',
      }
    }
  }

  const companyPayload = {
    name:          companyName,
    email:         companyEmail,
    phone:         companyPhone ?? null,
    plan_id:       selectedPlan.id,
    status:        'demo' as const,
    account_type:  accountType,
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    settings,
  }

  let { data: company, error: companyError } = await supabase
    .from('companies')
    .insert(companyPayload)
    .select('id')
    .single()

  if (companyError?.message?.includes('demo') || companyError?.code === '22P02') {
    ;({ data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ ...companyPayload, status: 'trial' })
      .select('id')
      .single())
  }

  if (companyError) {
    return NextResponse.json({ error: 'Error al crear empresa: ' + companyError.message }, { status: 500 })
  }
  if (!company) {
    return NextResponse.json({ error: 'Error al crear empresa' }, { status: 500 })
  }

  // 3. Subscription placeholder (se activa al pagar en Stripe)
  await supabase.from('subscriptions').insert({
    company_id:            company.id,
    plan_id:               selectedPlan.id,
    status:                'cancelled',
    current_period_start:  new Date().toISOString(),
    current_period_end:    null,
  })

  // 3b. Default vehicle groups for account type
  await supabase.rpc('seed_default_vehicle_groups', {
    p_company_id: company.id,
    p_account_type: accountType,
  })

  await supabase.rpc('seed_default_alert_rules', {
    p_company_id: company.id,
  })

  // 4. Create auth user with company_id in metadata
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
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

  // 6. Send email confirmation link
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://trackprogps.mx'
  const confirmNext = '/dashboard?demo_tour=1'
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(confirmNext)}` },
  })

  const confirmUrl = linkData?.properties?.action_link
  if (confirmUrl && process.env['RESEND_API_KEY']) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env['RESEND_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    resendFromNoreply(),
        to:      [email],
        subject: 'Confirma tu cuenta en TrackPro GPS',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1E3A5F;padding:20px;border-radius:8px 8px 0 0;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:20px">TrackPro GPS</h1>
            </div>
            <div style="border:1px solid #E5E7EB;border-top:none;padding:24px;border-radius:0 0 8px 8px">
              <p>Hola <strong>${fullName}</strong>,</p>
              <p>Tu cuenta en TrackPro GPS fue creada. Confirma tu correo para activar el acceso:</p>
              <div style="text-align:center;margin:24px 0">
                <a href="${confirmUrl}"
                  style="background:#2563EB;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
                  Confirmar correo
                </a>
              </div>
              <p style="color:#6B7280;font-size:12px">
                Tras confirmar podrás explorar la app en modo demostración con datos de ejemplo y elegir el plan que prefieras.
              </p>
            </div>
          </div>
        `,
      }),
    })
  }

  return NextResponse.json({
    success: true,
    company_id: company.id,
    pending_checkout: resolvedPlanId ? { plan_id: resolvedPlanId, billing_period: billingPeriod ?? 'monthly' } : null,
  }, { status: 201 })
}
