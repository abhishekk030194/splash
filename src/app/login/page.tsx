'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ShoppingBag, ChefHat } from 'lucide-react'
import Link from 'next/link'
import { NookLogo } from '@/components/NookLogo'

type Role = 'buyer' | 'seller'

export default function LoginPage() {
  const [supabase] = useState(() => createClient())
  const [loading, setLoading] = useState<Role | null>(null)

  async function signIn(role: Role) {
    setLoading(role)
    const next = role === 'seller' ? '/seller/onboarding' : '/'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      toast.error(error.message)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col items-center justify-center p-5">

      {/* Brand */}
      <div className="flex flex-col items-center mb-10">
        <NookLogo size="lg" />
        <p className="text-muted-foreground mt-2 text-sm">Food from your nook</p>
      </div>

      {/* Role cards */}
      <div className="w-full max-w-sm space-y-3">

        {/* Buyer */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <p className="font-semibold text-sm">I want to order food</p>
              <p className="text-xs text-muted-foreground">Browse home kitchens near you</p>
            </div>
          </div>
          <GoogleButton
            label="Continue as Buyer"
            loading={loading === 'buyer'}
            disabled={loading !== null}
            onClick={() => signIn('buyer')}
          />
        </div>

        {/* Seller */}
        <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">I run a home kitchen</p>
              <p className="text-xs text-muted-foreground">List your kitchen and accept orders</p>
            </div>
          </div>
          <GoogleButton
            label="Continue as Seller"
            loading={loading === 'seller'}
            disabled={loading !== null}
            onClick={() => signIn('seller')}
          />
        </div>

      </div>

      <p className="text-xs text-muted-foreground mt-8 text-center max-w-xs">
        By continuing you agree to our{' '}
        <Link href="/privacy" className="underline hover:text-emerald-800 transition-colors">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}

function GoogleButton({ label, loading, disabled, onClick }: {
  label: string; loading: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 border border-gray-200 rounded-xl py-2.5 text-sm font-medium shadow-sm transition-colors"
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {loading ? 'Redirecting…' : label}
    </button>
  )
}
