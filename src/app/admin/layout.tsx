'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Store, ShoppingBag, Users } from 'lucide-react'

const TABS = [
  { href: '/admin',        label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/stores', label: 'Stores',    icon: Store           },
  { href: '/admin/orders', label: 'Orders',    icon: ShoppingBag     },
  { href: '/admin/users',  label: 'Users',     icon: Users           },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <span className="text-xl">🍱</span>
        <span className="font-bold text-gray-800">Nook Admin</span>
        <span className="ml-auto text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">Admin</span>
      </div>

      {/* Page content */}
      <div className="pb-24">
        {children}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-10">
        <div className="flex max-w-2xl mx-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? path === '/admin' : path.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
                  active ? 'text-emerald-800' : 'text-muted-foreground hover:text-gray-700'
                }`}
              >
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
