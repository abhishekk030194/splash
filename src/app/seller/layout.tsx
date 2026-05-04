'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutList, ShoppingBag, User, BarChart2 } from 'lucide-react'
import { NookLogo } from '@/components/NookLogo'

const tabs = [
  { href: '/seller/listings',  label: 'Menu',      icon: LayoutList },
  { href: '/seller/orders',    label: 'Orders',    icon: ShoppingBag },
  { href: '/seller/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/seller/account',   label: 'Account',   icon: User },
]

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <NookLogo />
          <span className="text-xs text-muted-foreground bg-emerald-50 text-emerald-800 px-2 py-1 rounded-full font-medium">Seller</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">{children}</main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-10">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors ${active ? 'text-emerald-800' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-emerald-800' : ''}`} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
