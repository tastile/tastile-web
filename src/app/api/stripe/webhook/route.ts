import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

export async function POST(request: Request) {
  let stripe
  try {
    stripe = getStripe()
  } catch {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Billing profile persistence is moving to the AWS application API.
  // Until that API exists, keep webhook signature verification active and
  // acknowledge events until the AWS profile writer is enabled.
  void event

  return NextResponse.json({ received: true })
}
