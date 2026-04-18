'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, OrderStatus } from '@/types'
import { orderColor, orderRef } from '@/lib/order-color'
import { ShoppingBag, ChevronRight, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
  items: OrderItem[]
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
      const orderIds = data.map((o: any) => o.id)
      const { data: allItems } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)

      const itemsByOrder: Record<string, OrderItem[]> = {}
      for (const item of allItems || []) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
        itemsByOrder[item.order_id].push(item)
      }

      setOrders(data.map((o: any) => ({
        ...o,
        store_name: o.store?.name,
        store: undefined,
        items: itemsByOrder[o.id] || [],
      })))
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
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
          <div className="space-y-3">
            {active.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Past Orders</p>
          <div className="space-y-3">
            {past.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function expectedByTime(createdAt: string, etaMinutes: number): string {
  const placed = new Date(createdAt)
  const expected = new Date(placed.getTime() + etaMinutes * 60 * 1000)
  return expected.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

function cancellationMessage(status: string, reason: string | null): string | null {
  if (!['rejected', 'cancelled'].includes(status)) return null
  if (reason === 'stock_unavailable')     return 'Item(s) not in stock'
  if (reason === 'delivery_not_possible') return 'Delivery not possible'
  if (reason === 'auto_timeout')          return 'Auto-cancelled: no response in time'
  if (status === 'rejected')              return 'Rejected by kitchen'
  return 'Order cancelled'
}

function OrderCard({ order }: { order: OrderWithStore }) {
  const badge = STATUS_BADGE[order.status]
  const color = orderColor(order.order_type)
  const showEta = order.eta_minutes && order.order_type === 'spot' &&
    ['accepted', 'dispatched'].includes(order.status)
  const cancelMsg = cancellationMessage(order.status, order.cancellation_reason)
  return (
    <Link href={`/orders/${order.id}`}>
      <div className="bg-white rounded-2xl border p-4 hover:shadow-sm transition-shadow"
           style={{ borderLeftWidth: 4, borderLeftColor: color.border }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{order.store_name}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: color.bg, color: color.text }}>
                {orderRef(order.id)}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{order.order_type}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
            {order.delivery_time && (
              <p className="text-xs font-medium mt-1 flex items-center gap-1" style={{ color: color.text }}>
                <Clock className="w-3 h-3" />
                Deliver by {order.delivery_time.slice(0, 5)}
              </p>
            )}
            {showEta && (
              <div className="mt-2 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                <p className="text-xs text-orange-700 font-medium">
                  Expect order in <span className="font-bold">{order.eta_minutes} min</span>
                  {' · '}by <span className="font-bold">{expectedByTime(order.created_at, order.eta_minutes!)}</span>
                </p>
              </div>
            )}
            {cancelMsg && (
              <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-600 font-medium">{cancelMsg}</p>
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>

        {/* Items */}
        {order.items.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="space-y-1">
              {order.items.map(item => (
                <div key={item.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.title} × {item.quantity}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-0.5">
                    <span>Order: {orderRef(order.id)}</span>
                    <span>·</span>
                    <span>Item: #{item.id.replace(/-/g, '').slice(0, 8).toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-2" />
          </>
        )}

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-bold text-orange-600">₹{order.total.toFixed(2)}</span>
        </div>
      </div>
    </Link>
  )
}
