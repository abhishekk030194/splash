'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, OrderStatus } from '@/types'
import { orderColor, orderRef } from '@/lib/order-color'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Clock, CheckCircle2, Circle, XCircle } from 'lucide-react'

const STATUS_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'created',           label: 'Order Placed',       description: 'Waiting for kitchen to accept' },
  { status: 'accepted',          label: 'Accepted',            description: 'Kitchen is preparing your food' },
  { status: 'dispatched',        label: 'On the way',          description: 'Your order is on its way' },
  { status: 'delivered',         label: 'Delivered',           description: 'Enjoy your meal!' },
]

const CANCELLED_STATUSES: OrderStatus[] = ['rejected', 'cancelled', 'payment_failed']

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

export default function OrderTrackerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()

    // Realtime subscription
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          setOrder(prev => prev ? { ...prev, ...(payload.new as Order) } : null)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function loadOrder() {
    const { data: o } = await supabase
      .from('orders')
      .select('*, store:stores(name)')
      .eq('id', id)
      .single()

    const { data: i } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id)

    if (o) {
      setStoreName((o.store as any)?.name || '')
      const { store: _, ...orderData } = o
      setOrder(orderData as Order)
    }
    setItems(i || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      <div className="h-8 bg-gray-100 rounded animate-pulse w-1/2" />
      <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  )

  if (!order) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground p-4">
      <p>Order not found</p>
      <Button className="mt-4 bg-orange-500 hover:bg-orange-600" onClick={() => router.push('/orders')}>
        Back to Orders
      </Button>
    </div>
  )

  const isCancelled = CANCELLED_STATUSES.includes(order.status)
  const badge = STATUS_BADGE[order.status]
  const color = orderColor(order.order_type)

  // Find current step index for progress
  const currentStepIndex = isCancelled
    ? -1
    : STATUS_STEPS.findIndex(s => s.status === order.status)

  return (
    <div className="p-4 pb-10">
      {/* Header with color accent bar */}
      <div className="rounded-2xl border p-4 mb-5 bg-white"
           style={{ borderLeftWidth: 4, borderLeftColor: color.border }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/orders')} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight">Order from {storeName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: color.bg, color: color.text }}>
                {orderRef(order.id)}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery time for preorders */}
      {(order as any).delivery_time && !isCancelled && (
        <div className="bg-pink-50 border border-pink-100 rounded-2xl p-3 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-pink-500 flex-shrink-0" />
          <p className="text-sm font-medium text-pink-700">
            Scheduled delivery at <span className="font-bold">{(order as any).delivery_time.slice(0, 5)}</span>
          </p>
        </div>
      )}

      {/* ETA for spot orders */}
      {order.eta_minutes && !(order as any).delivery_time && !isCancelled && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <p className="text-sm font-medium text-orange-700">
            Estimated delivery in <span className="font-bold">{order.eta_minutes} min</span>
          </p>
        </div>
      )}

      {/* Progress tracker */}
      {!isCancelled ? (
        <div className="bg-white rounded-2xl border p-4 mb-4">
          <p className="font-semibold text-sm mb-4">Order Progress</p>
          <div className="space-y-4">
            {STATUS_STEPS.map((step, idx) => {
              const done = currentStepIndex >= idx
              const active = currentStepIndex === idx
              return (
                <div key={step.status} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {done
                      ? <CheckCircle2 className={`w-5 h-5 ${active ? 'text-orange-500' : 'text-green-500'}`} />
                      : <Circle className="w-5 h-5 text-gray-300" />
                    }
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-6 mt-1 ${done && currentStepIndex > idx ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${done ? (active ? 'text-orange-600' : 'text-gray-800') : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {active && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 mb-4">
          <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">{badge.label}</p>
            <p className="text-xs text-red-500 mt-0.5">
              {order.status === 'rejected' ? 'The kitchen could not accept this order.' : 'This order was cancelled.'}
            </p>
          </div>
        </div>
      )}

      {/* Order items */}
      <div className="bg-white rounded-2xl border p-4 space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Order Items</p>
          <span className="text-xs font-mono text-muted-foreground">
            Order: {orderRef(order.id)}
          </span>
        </div>
        <Separator />
        {items.map(item => (
          <div key={item.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{item.title} × {item.quantity}</span>
              <span className="font-semibold">₹{(item.price * item.quantity).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>Order ID: {orderRef(order.id)}</span>
              <span>·</span>
              <span>Item ID: #{item.id.replace(/-/g, '').slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between font-bold text-sm">
          <span>Total</span>
          <span className="text-orange-600">₹{order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Order meta */}
      <div className="bg-white rounded-2xl border p-4 space-y-1.5">
        <p className="font-semibold text-sm mb-2">Details</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Order type</span>
          <span className="capitalize">{order.order_type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Placed at</span>
          <span>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Order ID</span>
          <span className="font-mono text-xs">#{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>
    </div>
  )
}
