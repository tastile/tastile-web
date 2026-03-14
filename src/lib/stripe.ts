import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

export const PLANS = {
  free: { name: 'Free', priceId: null },
  pro_monthly: {
    name: 'Pro (Monthly)',
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    amount: 500, // $5.00/month
  },
  pro_yearly: {
    name: 'Pro (Yearly)',
    priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
    amount: 5000, // $50.00/year
  },
} as const
