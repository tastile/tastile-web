import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlans, getStripe } from '@/lib/stripe'

export async function POST(request: Request) {
  let stripe
  let plans
  try {
    stripe = getStripe()
    plans = getPlans()
  } catch {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const interval = body.interval === 'yearly' ? 'yearly' : 'monthly'

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price: interval === 'yearly' ? plans.pro_yearly.priceId : plans.pro_monthly.priceId,
      quantity: 1,
    }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?billing=cancelled`,
  })

  return NextResponse.json({ url: session.url })
}
