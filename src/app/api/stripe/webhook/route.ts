import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  // Lazy load Supabase client to avoid build-time errors
  const { createClient } = await import('@supabase/supabase-js')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customerId = subscription.customer as string
      const status = subscription.status
      const plan = status === 'active' ? 'pro' : 'free'

      await supabaseAdmin
        .from('profiles')
        .update({
          plan,
          stripe_subscription_id: subscription.id,
          plan_updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId)
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer as string
      await supabaseAdmin
        .from('profiles')
        .update({
          plan: 'free',
          stripe_subscription_id: null,
          plan_updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
