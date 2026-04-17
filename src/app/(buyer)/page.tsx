'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Store } from '@/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Search, Clock, ChevronRight } from 'lucide-react'

export default function HomePage() {
  const [supabase] = useState(() => createClient())
  const [stores, setStores] = useState<Store[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStores() }, [])

  async function loadStores() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setStores(data || [])
    setLoading(false)
  }

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 space-y-5">

      {/* Hero */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80 mb-1">Good {greeting()},</p>
        <h1 className="text-xl font-bold mb-3">What are you craving?</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 bg-white text-gray-900 border-0"
            placeholder="Search kitchens or dishes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Ad / Promo Banner placeholder */}
      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Featured</p>
          <p className="font-semibold text-sm mt-0.5">Fresh home food in your society</p>
          <p className="text-xs text-muted-foreground mt-0.5">Order from local home kitchens</p>
        </div>
        <div className="text-4xl">🏠</div>
      </div>

      {/* Kitchens */}
      <div>
        <h2 className="font-semibold text-base mb-3">
          {search ? `Results for "${search}"` : 'Kitchens near you'}
        </h2>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">🍽️</div>
            <p className="font-medium">No kitchens found</p>
            {search && <p className="text-sm mt-1">Try a different search</p>}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(store => (
            <Link key={store.id} href={`/store/${store.id}`}>
              <div className="bg-white rounded-2xl border p-4 flex items-center gap-3 hover:border-orange-200 transition-colors">
                <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {store.image_url
                    ? <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
                    : <span className="text-2xl">🍳</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{store.name}</p>
                    <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">Open</Badge>
                  </div>
                  {store.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{store.description}</p>}
                  {((store as any).open_from && (store as any).open_until) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {(store as any).open_from?.slice(0,5)} – {(store as any).open_until?.slice(0,5)}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
