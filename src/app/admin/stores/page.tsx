'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function AdminStoresPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [stores, setStores]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
    if (!profile || profile.role !== 'admin') { router.push('/'); return }
    await loadStores()
  }

  async function loadStores() {
    const { data } = await supabase
      .from('stores')
      .select('*, owner:users(name, phone)')
      .order('created_at', { ascending: false })
    setStores(data || [])
    setLoading(false)
  }

  async function toggleActive(storeId: string, val: boolean) {
    setStores(prev => prev.map(s => s.id === storeId ? { ...s, is_active: val } : s))
    const { error } = await supabase.from('stores').update({ is_active: val }).eq('id', storeId)
    if (error) {
      toast.error('Failed to update store')
      setStores(prev => prev.map(s => s.id === storeId ? { ...s, is_active: !val } : s))
    } else {
      toast.success(val ? 'Store activated' : 'Store deactivated')
    }
  }

  const displayed = stores.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.owner?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'active' ? s.is_active : !s.is_active)
    return matchSearch && matchFilter
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kitchens</h1>
        <span className="text-xs text-muted-foreground">{stores.length} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or owner…"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-white text-emerald-800 shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {f}
            {f === 'active'   && ` (${stores.filter(s => s.is_active).length})`}
            {f === 'inactive' && ` (${stores.filter(s => !s.is_active).length})`}
          </button>
        ))}
      </div>

      {/* Stores list */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">No kitchens found</p>
        )}
        {displayed.map(store => (
          <div key={store.id} className="bg-white rounded-2xl border p-4">
            <div className="flex items-start gap-3">
              {store.image_url
                ? <img src={store.image_url} alt={store.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 text-xl">🍱</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{store.name}</p>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    store.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {store.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Owner: {store.owner?.name || '—'} {store.owner?.phone ? `· ${store.owner.phone}` : ''}
                </p>
                {store.society_name && (
                  <p className="text-xs text-muted-foreground">📍 {store.society_name}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                  {store.offers_delivery && <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded">🛵 Delivery</span>}
                  {store.offers_pickup   && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">🏃 Pickup</span>}
                  {store.accepts_cod     && <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">💵 COD</span>}
                  {store.accepts_online_on_delivery && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">📱 Pay before delivery</span>}
                </div>
              </div>
              <Switch
                checked={store.is_active}
                onCheckedChange={val => toggleActive(store.id, val)}
              />
            </div>
            <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
              <Metric label="Delivery fee (spot)"    value={`₹${store.delivery_fee_spot ?? 0}`} />
              <Metric label="Delivery fee (pre)"     value={`₹${store.delivery_fee_preorder ?? 0}`} />
              <Metric label="Commission"             value={`${store.commission_pct ?? 0}%`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
