'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus } from '@/types'
import { orderColor, orderRef } from '@/lib/order-color'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  created:           { label: 'Placed',            className: 'bg-yellow-100 text-yellow-800' },
  accepted:          { label: 'Accepted',           className: 'bg-blue-100 text-blue-800' },
  waiting_payment:   { label: 'Awaiting Payment',   className: 'bg-purple-100 text-purple-800' },
  payment_confirmed: { label: 'Payment Confirmed',  className: 'bg-indigo-100 text-indigo-800' },
  dispatched:        { label: 'On the way',         className: 'bg-orange-100 text-orange-800' },
  delivered:         { label: 'Delivered',          className: 'bg-green-100 text-green-800' },
  rejected:          { label: 'Rejected',           className: 'bg-red-100 text-red-800' },
  cancelled:         { label: 'Cancelled',          className: 'bg-gray-100 text-gray-600' },
  payment_failed:    { label: 'Payment Failed',     className: 'bg-red-100 text-red-800' },
}

interface OrderWithStore extends Order {
  store_name?: string
}

export default function OrdersPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [orders, setOrders] = useState<OrderWithStore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) { setLoading(false); return }

    const { data } = await supabase
      .from('orders')
      .select('*, store:stores(name)')
      .eq('buyer_id', profile.id)
      .order('created_at', { ascending: false })

    if (data) {
      setOrders(data.map((o: any) => ({
        ...o,
        store_name: o.store?.name,
        store: undefined,
      })))
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  if (orders.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground p-4">
      <ShoppingBag className="w-12 h-12 mb-3 opacity-30" />
      <p className="font-medium">No orders yet</p>
      <p className="text-sm mt-1">Your orders will appear here</p>
      <Link href="/">
        <Button className="mt-4 bg-orange-500 hover:bg-orange-600">Browse Kitchens</Button>
      </Link>
    </div>
  )

  const active = orders.filter(o => !['delivered', 'rejected', 'cancelled', 'payment_failed'].includes(o.status))
  const past = orders.filter(o => ['delivered', 'rejected', 'cancelled', 'payment_failed'].includes(o.status))

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-lg font-bold">Your Orders</h1>

      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">Active</p>
          <div className="space-y-2">
            {active.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Past Orders</p>
          <div className="space-y-2">
            {past.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function OrderCard({ order }: { order: OrderWithStore }) {
  const badge = STATUS_BADGE[order.status]
  const color = orderColor(order.order_type)
  return (
    <Link href={`/orders/${order.id}`}>
      <div className="bg-white rounded-2xl border p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
           style={{ borderLeftWidth: 4, borderLeftColor: color.border }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-sm">{order.store_name}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                  style={{ backgroundColor: color.bg, color: color.text }}>
              {orderRef(order.id)}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{order.order_type}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
          </p>
          <p className="text-sm font-semibold text-orange-600 mt-1">₹{order.total.toFixed(2)}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  )
}
