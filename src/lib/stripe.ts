import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

export const PLANS = {
  free: { name: 'Free', price: null },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    amount: 500, // $5.00
  },
} as const
