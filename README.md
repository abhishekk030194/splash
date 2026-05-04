# Nook — Food from your society

Nook is a two-sided food marketplace PWA connecting home kitchen operators with buyers within housing societies. Buyers discover nearby kitchens by location; sellers manage menus, orders, and view analytics.

## Features

### Buyers
- Location-aware kitchen discovery (society-level, radius-based, or citywide)
- Spot orders (order now, pick up / get delivered soon)
- Pre-orders (scheduled delivery windows)
- Real-time order tracking and push notifications
- Delivery or pickup, with online / COD / online-on-delivery payment options

### Sellers
- Menu management — items, groups, combos, availability toggles
- Flexible order windows — spot time slots + multiple pre-order windows
- Order management — accept, dispatch, reject with reasons
- Analytics dashboard — revenue, order funnel, top items, cancellation breakdown

### Admin
- Platform-wide GMV, order counts, active kitchens, and user metrics
- Recent orders across all kitchens

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database / Auth**: Supabase
- **Payments**: Razorpay
- **Error monitoring**: Sentry
- **Push notifications**: Web Push API
- **Charts**: Recharts
- **PWA**: `@ducanh2912/next-pwa` with custom service worker
- **Styling**: Tailwind CSS v4, shadcn/ui

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=

SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

INTERNAL_API_SECRET=
```

## Project Structure

```
src/
  app/
    (buyer)/          # Buyer-facing pages (home, store, cart, orders, account)
    seller/           # Seller pages (listings, orders, analytics, onboarding, account)
    admin/            # Admin dashboard (overview, stores, orders, users)
    api/              # API routes (auth, orders, payments, push)
    login/            # Auth pages
  components/         # Shared UI components
  lib/                # Supabase client, push helpers, rate limiting
  types/              # Shared TypeScript types
```
