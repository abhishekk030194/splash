'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, User } from 'lucide-react'

const tabs = [
  { href: '/',        label: 'Home',    icon: Home },
  { href: '/orders',  label: 'Orders',  icon: ShoppingBag },
  { href: '/account', label: 'Account', icon: User },
]

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-orange-600 text-lg">🍱 Splash</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-10">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors ${active ? 'text-orange-600' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
