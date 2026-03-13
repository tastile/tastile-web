# Tastile Web

Landing page, dashboard, iOS PWA, and billing for Tastile.

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Auth, DB, Realtime)
- Stripe (billing)
- Vercel (deployment target)

## Routes
- / — Landing page (public)
- /pricing — Pricing plans (public)
- /privacy — Privacy policy (public)
- /terms — Terms of service (public)
- /login — Google OAuth login
- /dashboard/* — Authenticated dashboard
- /app/* — iOS PWA companion

## Commands
- `pnpm dev` — Start dev server
- `pnpm build` — Production build
- `pnpm lint` — Run linter
