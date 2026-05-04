'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { orderRef } from '@/lib/order-color'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

const ALL_STATUSES = ['created', 'waiting_payment', 'payment_confirmed', 'accepted', 'dispatched', 'delivered', 'cancelled', 'rejected', 'payment_failed'] as const
type Status = typeof ALL_STATUSES[number]

const STATUS_COLORS: Record<string, string> = {
  created:           'bg-yellow-100 text-yellow-700',
  waiting_payment:   'bg-purple-100 text-purple-700',
  payment_confirmed: 'bg-indigo-100 text-indigo-700',
  accepted:          'bg-blue-100 text-blue-700',
  dispatched:        'bg-emerald-100 text-emerald-800',
  delivered:         'bg-green-100 text-green-700',
  cancelled:         'bg-gray-100 text-gray-500',
  rejected:          'bg-red-100 text-red-700',
  payment_failed:    'bg-red-100 text-red-700',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online:              '💳 Online',
  cod:                 '💵 COD',
  online_on_delivery:  '📱 Before Delivery',
}

const FILTER_GROUPS = [
  { label: 'All',      value: 'all' },
  { label: 'Active',   value: 'active' },
  { label: 'Done',     value: 'done' },
  { label: 'Failed',   value: 'failed' },
] as const

type FilterGroup = typeof FILTER_GROUPS[number]['value']

const ACTIVE_STATUSES  = ['created', 'waiting_payment', 'payment_confirmed', 'accepted', 'dispatched']
const DONE_STATUSES    = ['delivered']
const FAILED_STATUSES  = ['cancelled', 'rejected', 'payment_failed']

export default function AdminOrdersPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [group, setGroup]     = useState<FilterGroup>('all')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
    if (!profile || profile.role !== 'admin') { router.push('/'); return }
    await loadOrders()
  }

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select('id, status, total, order_type, fulfillment_type, payment_method, payment_collected_at, created_at, store:stores(name), buyer:users(name, phone)')
      .order('created_at', { ascending: false })
      .limit(200)
    setOrders(data || [])
    setLoading(false)
  }

  const displayed = orders.filter(o => {
    const storeName = (o.store as any)?.name?.toLowerCase() ?? ''
    const buyerName = (o.buyer as any)?.name?.toLowerCase() ?? ''
    const buyerPhone = (o.buyer as any)?.phone ?? ''
    const ref = orderRef(o.id).toLowerCase()
    const q   = search.toLowerCase()
    const matchSearch = !search || storeName.includes(q) || buyerName.includes(q) || buyerPhone.includes(q) || ref.includes(q)

    let matchGroup = true
    if (group === 'active')  matchGroup = ACTIVE_STATUSES.includes(o.status)
    if (group === 'done')    matchGroup = DONE_STATUSES.includes(o.status)
    if (group === 'failed')  matchGroup = FAILED_STATUSES.includes(o.status)

    return matchSearch && matchGroup
  })

  const groupCount = (g: FilterGroup) => {
    if (g === 'all')    return orders.length
    if (g === 'active') return orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length
    if (g === 'done')   return orders.filter(o => DONE_STATUSES.includes(o.status)).length
    if (g === 'failed') return orders.filter(o => FAILED_STATUSES.includes(o.status)).length
    return 0
  }

  const gmv = displayed
    .filter(o => !FAILED_STATUSES.includes(o.status))
    .reduce((s, o) => s + (o.total ?? 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Orders</h1>
        <span className="text-xs text-muted-foreground">{orders.length} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by store, buyer, phone, #ref…"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter group tabs */}
      <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
        {FILTER_GROUPS.map(f => (
          <button
            key={f.value}
            onClick={() => setGroup(f.value)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              group === f.value ? 'bg-white text-emerald-800 shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {f.label} ({groupCount(f.value)})
          </button>
        ))}
      </div>

      {/* GMV summary for current view */}
      {displayed.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-emerald-800">GMV in view (excl. failed)</span>
          <span className="text-sm font-bold text-emerald-800">₹{gmv.toFixed(0)}</span>
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">No orders found</p>
        )}
        {displayed.map(order => {
          const store = (order.store as any)?.name ?? '—'
          const buyer = (order.buyer as any)?.name ?? '—'
          const phone = (order.buyer as any)?.phone ?? ''
          const date  = new Date(order.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
          })
          return (
            <div key={order.id} className="bg-white rounded-2xl border p-4 space-y-2.5">
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-gray-500">{orderRef(order.id)}</span>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{store}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-800">₹{(order.total ?? 0).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">{date}</p>
                </div>
              </div>

              {/* Buyer + meta */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-700 font-medium">{buyer}</span>
                {phone && <span className="text-xs text-muted-foreground">{phone}</span>}
                <span className="ml-auto text-xs text-muted-foreground capitalize">{order.fulfillment_type ?? ''}</span>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {order.payment_method && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
                  </span>
                )}
                {order.payment_collected_at && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">✅ Paid</span>
                )}
                {order.order_type === 'preorder' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-pink-100 text-pink-700">Pre-order</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
