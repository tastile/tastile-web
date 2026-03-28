import Stripe from 'stripe'

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
  })
}

function requireEnv(name: 'STRIPE_PRO_MONTHLY_PRICE_ID' | 'STRIPE_PRO_YEARLY_PRICE_ID'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

export function getPlans() {
  return {
    free: { name: 'Free', priceId: null },
    pro_monthly: {
      name: 'Pro (Monthly)',
      priceId: requireEnv('STRIPE_PRO_MONTHLY_PRICE_ID'),
      amount: 500,
    },
    pro_yearly: {
      name: 'Pro (Yearly)',
      priceId: requireEnv('STRIPE_PRO_YEARLY_PRICE_ID'),
      amount: 5000,
    },
  } as const
}
