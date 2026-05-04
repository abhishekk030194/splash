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
import { toast } from 'sonner'
import { ArrowLeft, Clock, CheckCircle2, Circle, XCircle } from 'lucide-react'
import { OrderTypePill } from '@/components/OrderTypePill'

declare global { interface Window { Razorpay: any } }

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && window.Razorpay) { resolve(true); return }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

function cancellationMessage(status: OrderStatus, reason: string | null): string {
  if (reason === 'buyer_cancelled')       return 'You cancelled this order.'
  if (reason === 'stock_unavailable')     return 'Kitchen rejected: item(s) not in stock.'
  if (reason === 'delivery_not_possible') return 'Kitchen rejected: delivery not possible right now.'
  if (reason === 'auto_timeout')          return 'Auto-cancelled: kitchen did not respond in time.'
  if (status === 'rejected')              return 'The kitchen could not accept this order.'
  return 'This order was cancelled.'
}

const STEPS_ONLINE: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'payment_confirmed', label: 'Payment Confirmed', description: 'Waiting for kitchen to accept' },
  { status: 'accepted',          label: 'Accepted',          description: 'Kitchen is preparing your food' },
  { status: 'dispatched',        label: 'On the way',        description: 'Your order is on its way' },
  { status: 'delivered',         label: 'Delivered',         description: 'Enjoy your meal!' },
]

const STEPS_COD: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'created',    label: 'Order Placed', description: 'Waiting for kitchen to accept' },
  { status: 'accepted',   label: 'Accepted',     description: 'Kitchen is preparing your food' },
  { status: 'dispatched', label: 'On the way',   description: 'Your order is on its way — keep payment ready' },
  { status: 'delivered',  label: 'Delivered',    description: 'Enjoy your meal!' },
]

function getSteps(paymentMethod: string | null, fulfillmentType: string | null) {
  const isCod = paymentMethod === 'cod' || paymentMethod === 'online_on_delivery'
  const steps = isCod ? STEPS_COD : STEPS_ONLINE
  if (fulfillmentType !== 'pickup') return steps
  return steps.map(s => {
    if (s.status === 'dispatched') return { ...s, label: 'Ready for Pickup', description: 'Head to the kitchen to collect your order' }
    if (s.status === 'delivered')  return { ...s, label: 'Collected',        description: 'Hope you enjoy your meal!' }
    return s
  })
}

function effectiveStepIndex(status: OrderStatus, steps: typeof STEPS_ONLINE): number {
  const idx = steps.findIndex(s => s.status === status)
  if (idx >= 0) return idx
  return -1 // waiting_payment or unknown — nothing ticked
}

const CANCELLED_STATUSES: OrderStatus[] = ['rejected', 'cancelled', 'payment_failed']

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  created:           { label: 'Order Placed',       className: 'bg-yellow-100 text-yellow-800' },
  accepted:          { label: 'Accepted',           className: 'bg-blue-100 text-blue-800' },
  waiting_payment:   { label: 'Awaiting Payment',   className: 'bg-purple-100 text-purple-800' },
  payment_confirmed: { label: 'Payment Confirmed',  className: 'bg-indigo-100 text-indigo-800' },
  dispatched:        { label: 'On the way',         className: 'bg-emerald-100 text-emerald-900' },
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
  const [paying, setPaying] = useState(false)

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

  async function cancelOrder() {
    if (!confirm('Cancel this order?')) return
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', cancellation_reason: 'buyer_cancelled' })
      .eq('id', id)
      .in('status', ['created', 'waiting_payment', 'payment_confirmed']) // safety: only cancel before kitchen accepts
    if (error) toast.error('Could not cancel order')
    else toast.success('Order cancelled')
  }

  async function payNow() {
    if (!order) return
    setPaying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Please log in'); return }

      // Skip-payment mode for testing
      if (process.env.NEXT_PUBLIC_SKIP_PAYMENT === 'true') {
        await supabase.from('orders').update({ payment_collected_at: new Date().toISOString() }).eq('id', id)
        toast.success('Payment done! (test mode)')
        return
      }

      const rzpRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: order.total, receipt: order.id }),
      })
      if (!rzpRes.ok) { toast.error('Could not initiate payment'); return }
      const { rzp_order_id, amount, currency } = await rzpRes.json()

      const loaded = await loadRazorpayScript()
      if (!loaded) { toast.error('Could not load payment gateway'); return }

      await new Promise<void>(resolve => {
        const rzp = new window.Razorpay({
          key:      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount, currency,
          name:     'Nook',
          description: 'Payment for order',
          order_id: rzp_order_id,
          prefill:  { email: user.email || '' },
          method:   { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
          theme:    { color: '#f97316' },
          handler: async (response: any) => {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                order_ids: [id],
                amount: order.total,
                mode: 'delivery_payment',
              }),
            })
            if (verifyRes.ok) toast.success('Payment done! Your order will be delivered shortly.')
            else toast.error('Payment verification failed. Contact support if amount was deducted.')
            resolve()
          },
          modal: { ondismiss: () => resolve() },
        })
        rzp.on('payment.failed', () => { toast.error('Payment failed. Please try again.'); resolve() })
        rzp.open()
      })
    } finally {
      setPaying(false)
    }
  }

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
      <Button className="mt-4 bg-emerald-700 hover:bg-emerald-800" onClick={() => router.push('/orders')}>
        Back to Orders
      </Button>
    </div>
  )

  const isCancelled = CANCELLED_STATUSES.includes(order.status)
  const rawBadge = STATUS_BADGE[order.status]
  const badge = (order.fulfillment_type === 'pickup' && order.status === 'dispatched')
    ? { label: 'Ready for Pickup', className: rawBadge.className }
    : (order.fulfillment_type === 'pickup' && order.status === 'delivered')
    ? { label: 'Collected', className: rawBadge.className }
    : rawBadge
  const color = orderColor(order.order_type)

  // Pick progress steps based on payment method
  const STATUS_STEPS = getSteps(order.payment_method, order.fulfillment_type)
  const currentStepIndex = isCancelled ? -1 : effectiveStepIndex(order.status, STATUS_STEPS)

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
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: color.bg, color: color.text }}>
                {orderRef(order.id)}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
              <OrderTypePill type={order.order_type} />
            </div>
          </div>
        </div>
      </div>

      {/* Awaiting payment banner */}
      {order.status === 'waiting_payment' && (
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <p className="text-sm font-medium text-purple-700">Awaiting payment — complete payment to confirm your order.</p>
        </div>
      )}

      {/* COD/pay-before-delivery — waiting for kitchen to accept */}
      {order.status === 'created' && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-3 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <p className="text-sm font-medium text-yellow-700">
            Order placed — waiting for kitchen to accept.
            {order.payment_method === 'cod' && (order.fulfillment_type === 'pickup' ? ' Keep cash ready when you collect.' : ' Keep cash ready on delivery.')}
            {order.payment_method === 'online_on_delivery' && ' You can pay online once the kitchen accepts.'}
          </p>
        </div>
      )}

      {/* Pay Online Before Delivery — pay now prompt */}
      {order.payment_method === 'online_on_delivery' && !order.payment_collected_at
        && ['accepted', 'dispatched'].includes(order.status) && !isCancelled && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">Payment pending</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {order.status === 'dispatched'
                  ? (order.fulfillment_type === 'pickup' ? 'Order is ready — pay now to collect.' : 'Order is on its way — pay now to receive it.')
                  : (order.fulfillment_type === 'pickup' ? 'Pay anytime before you collect.' : 'Pay anytime before delivery.')}
              </p>
              <Button
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white w-full h-9 text-sm"
                onClick={payNow}
                disabled={paying}
              >
                {paying ? 'Opening payment…' : `Pay ₹${order.total.toFixed(2)} Now`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Online Before Delivery — paid confirmation */}
      {order.payment_method === 'online_on_delivery' && order.payment_collected_at && !isCancelled && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-3 flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm font-medium text-green-700">Payment done — your order is on its way.</p>
        </div>
      )}

      {/* Delivery address banner */}
      {order.delivery_address && !isCancelled && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-0.5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            📍 Delivering to
          </p>
          {order.delivery_name && (
            <p className="text-sm font-semibold text-gray-800">
              {order.delivery_name}
              {order.delivery_phone && <span className="font-normal text-muted-foreground"> · {order.delivery_phone}</span>}
            </p>
          )}
          <p className="text-sm text-gray-700">
            {[order.delivery_flat, order.delivery_floor ? `${order.delivery_floor} floor` : null, order.delivery_apartment, order.delivery_address].filter(Boolean).join(', ')}
          </p>
          {order.delivery_landmark && (
            <p className="text-xs text-muted-foreground">Near: {order.delivery_landmark}</p>
          )}
        </div>
      )}

      {/* Fulfillment type */}
      {order.fulfillment_type && !isCancelled && (
        <div className={`rounded-2xl p-3 flex items-center gap-2 mb-4 ${
          order.fulfillment_type === 'pickup'
            ? 'bg-blue-50 border border-blue-100'
            : 'bg-emerald-50 border border-emerald-100'
        }`}>
          <span className="text-lg">{order.fulfillment_type === 'pickup' ? '🏃' : '🛵'}</span>
          <p className={`text-sm font-medium ${order.fulfillment_type === 'pickup' ? 'text-blue-700' : 'text-emerald-800'}`}>
            {order.fulfillment_type === 'pickup'
              ? 'Self pickup — head to the kitchen to collect your order'
              : 'Delivery — kitchen will deliver to your location'}
          </p>
        </div>
      )}

      {/* Delivery time for preorders */}
      {order.delivery_time && !isCancelled && (
        <div className="bg-pink-50 border border-pink-100 rounded-2xl p-3 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-pink-500 flex-shrink-0" />
          <p className="text-sm font-medium text-pink-700">
            Scheduled delivery at <span className="font-bold">{order.delivery_time.slice(0, 5)}</span>
          </p>
        </div>
      )}

      {/* ETA for spot orders */}
      {order.eta_minutes && !order.delivery_time && !isCancelled && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800">
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
                      ? <CheckCircle2 className={`w-5 h-5 ${active ? 'text-emerald-700' : 'text-green-500'}`} />
                      : <Circle className="w-5 h-5 text-gray-300" />
                    }
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-6 mt-1 ${done && currentStepIndex > idx ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${done ? (active ? 'text-emerald-800' : 'text-gray-800') : 'text-gray-400'}`}>
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
              {cancellationMessage(order.status, order.cancellation_reason)}
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
        {order.delivery_fee > 0 && (
          <>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Items subtotal</span>
              <span>₹{(order.total - order.delivery_fee).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery fee</span>
              <span>₹{order.delivery_fee.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-bold text-sm">
          <span>Total</span>
          <span className="text-emerald-800">₹{order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Order meta */}
      <div className="bg-white rounded-2xl border p-4 space-y-1.5">
        <p className="font-semibold text-sm mb-2">Details</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Order type</span>
          <span className="capitalize">{order.order_type}</span>
        </div>
        {order.fulfillment_type && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fulfillment</span>
            <span>{order.fulfillment_type === 'pickup' ? '🏃 Self Pickup' : '🛵 Delivery'}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Placed on</span>
          <span>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Placed at</span>
          <span>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}</span>
        </div>
        {order.payment_method && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment</span>
            <span className="flex items-center gap-1">
              {order.payment_method === 'cod'
                ? (order.payment_collected_at ? '✅ Cash Collected' : '💵 Cash on Delivery')
                : order.payment_method === 'online_on_delivery'
                ? (order.payment_collected_at ? '✅ Payment Collected' : '📱 Pay on Delivery')
                : '💳 Paid Online'}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Order ID</span>
          <span className="font-mono text-xs">#{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      {/* Cancel button — only before kitchen accepts */}
      {(order.status === 'created' || order.status === 'payment_confirmed' || order.status === 'waiting_payment') && (
        <Button
          variant="outline"
          className="w-full border-red-200 text-red-600 hover:bg-red-50"
          onClick={cancelOrder}
        >
          Cancel Order
        </Button>
      )}
    </div>
  )
}
