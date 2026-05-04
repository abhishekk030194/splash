'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, OrderStatus } from '@/types'
import { orderColor, orderRef } from '@/lib/order-color'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Clock, RefreshCw, Settings } from 'lucide-react'
import Link from 'next/link'
import { OrderTypePill } from '@/components/OrderTypePill'

const NEXT_ACTIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string; className: string }[]>> = {
  created:           [{ status: 'accepted',   label: 'Accept',          className: 'bg-green-500 hover:bg-green-600 text-white' }],
  payment_confirmed: [{ status: 'accepted',   label: 'Accept',          className: 'bg-green-500 hover:bg-green-600 text-white' }],
  accepted:          [{ status: 'dispatched', label: 'Mark Dispatched', className: 'bg-emerald-700 hover:bg-emerald-800 text-white' }],
  dispatched:        [{ status: 'delivered',  label: 'Mark Delivered',  className: 'bg-green-500 hover:bg-green-600 text-white' }],
}

const REJECTION_REASONS = {
  spot:     [
    { value: 'stock_unavailable',     label: 'Stock not available' },
    { value: 'delivery_not_possible', label: 'Delivery not possible' },
  ],
  preorder: [
    { value: 'stock_unavailable', label: 'Stock not available' },
  ],
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  created:           { label: 'New Order',          className: 'bg-green-100 text-green-800' },
  accepted:          { label: 'Accepted',           className: 'bg-blue-100 text-blue-800' },
  waiting_payment:   { label: 'Awaiting Payment',   className: 'bg-purple-100 text-purple-700' },
  payment_confirmed: { label: 'Paid — New',         className: 'bg-green-100 text-green-800' },
  dispatched:        { label: 'Dispatched',         className: 'bg-emerald-100 text-emerald-900' },
  delivered:         { label: 'Delivered',          className: 'bg-green-100 text-green-800' },
  rejected:          { label: 'Rejected',           className: 'bg-red-100 text-red-800' },
  cancelled:         { label: 'Cancelled',          className: 'bg-gray-100 text-gray-600' },
  payment_failed:    { label: 'Payment Failed',     className: 'bg-red-100 text-red-800' },
}

const ACTIVE_STATUSES: OrderStatus[] = ['created', 'waiting_payment', 'payment_confirmed', 'accepted', 'dispatched']
const DONE_STATUSES: OrderStatus[]   = ['delivered', 'rejected', 'cancelled', 'payment_failed']

interface MenuItemMini {
  id: string
  delivery_time: string | null
  preorder_windows: { order_open: string; order_close: string; delivery_time: string }[]
}

interface FullOrder extends Order {
  items: OrderItem[]
  buyer_name?: string
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function resolveDeliveryTime(menuItem: MenuItemMini | undefined, orderCreatedAt: string): string | null {
  if (!menuItem) return null
  if (menuItem.delivery_time) return menuItem.delivery_time
  if (!menuItem.preorder_windows?.length) return null

  const orderHHMM = new Date(orderCreatedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  })
  const match = menuItem.preorder_windows.find(w =>
    orderHHMM >= w.order_open && orderHHMM < w.order_close
  )
  return match?.delivery_time ?? menuItem.preorder_windows[0].delivery_time
}

function SectionDivider({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <div className={`flex items-center gap-3 py-1`}>
      <div className={`flex-1 h-px ${colorClass.replace('text', 'bg').replace('-700', '-300')}`} />
      <span className={`text-sm font-bold px-3 py-1 rounded-full border ${colorClass} ${colorClass.replace('text', 'bg').replace('-700', '-50')} ${colorClass.replace('text', 'border').replace('-700', '-300')}`}>
        {label}
      </span>
      <div className={`flex-1 h-px ${colorClass.replace('text', 'bg').replace('-700', '-300')}`} />
    </div>
  )
}

export default function SellerOrdersPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [orders, setOrders] = useState<FullOrder[]>([])
  const [menuItemsById, setMenuItemsById] = useState<Record<string, MenuItemMini>>({})
  const [storeId, setStoreId] = useState<string | null>(null)
  const [defaultEta, setDefaultEta] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
    if (!profile) { setLoading(false); return }

    const { data: store } = await supabase.from('stores').select('id, default_eta_minutes').eq('owner_id', profile.id).single()
    if (!store) { setLoading(false); return }

    setStoreId(store.id)
    setDefaultEta((store as any).default_eta_minutes ?? null)
    await loadOrders(store.id)

    const channel = supabase
      .channel(`seller-orders-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, () => {
        loadOrders(store.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  async function loadOrders(sid: string) {
    const { data } = await supabase
      .from('orders')
      .select('*, buyer:users(name)')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!data) { setLoading(false); return }

    const orderIds = data.map((o: any) => o.id)
    const { data: allItems } = await supabase.from('order_items').select('*').in('order_id', orderIds)

    const itemsByOrder: Record<string, OrderItem[]> = {}
    for (const item of allItems || []) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push(item)
    }

    const fullOrders: FullOrder[] = data.map((o: any) => ({
      ...o,
      buyer_name: o.buyer?.name || 'Customer',
      buyer: undefined,
      items: itemsByOrder[o.id] || [],
    }))

    // Fetch menu item details for pre-orders to get delivery times
    const preOrderItemIds = [...new Set(
      fullOrders
        .filter(o => o.order_type === 'preorder')
        .flatMap(o => o.items.map(i => i.item_id))
    )]
    if (preOrderItemIds.length > 0) {
      const { data: mItems } = await supabase
        .from('menu_items')
        .select('id, delivery_time, preorder_windows')
        .in('id', preOrderItemIds)
      setMenuItemsById(Object.fromEntries((mItems || []).map((m: any) => [m.id, m])))
    }

    setOrders(fullOrders)
    setLoading(false)
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    setUpdating(prev => ({ ...prev, [orderId]: true }))
    const { data: { session } } = await supabase.auth.getSession()
    const body: any = { order_id: orderId, status: newStatus }
    if (newStatus === 'accepted' && defaultEta) body.eta_minutes = defaultEta

    const res = await fetch('/api/orders/update-status', {
      method:  'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      toast.error('Failed to update order')
    } else {
      toast.success(`Order ${STATUS_BADGE[newStatus].label.toLowerCase()}`)
      if (storeId) loadOrders(storeId)
    }
    setUpdating(prev => ({ ...prev, [orderId]: false }))
  }

  async function markPaymentCollected(orderId: string) {
    setUpdating(prev => ({ ...prev, [orderId]: true }))
    const { error } = await supabase
      .from('orders')
      .update({ payment_collected_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) toast.error('Failed to mark payment collected')
    else { toast.success('Payment marked as collected'); if (storeId) loadOrders(storeId) }
    setUpdating(prev => ({ ...prev, [orderId]: false }))
  }

  async function rejectOrder(orderId: string, reason: string) {
    setUpdating(prev => ({ ...prev, [orderId]: true }))
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/orders/update-status', {
      method:  'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body:    JSON.stringify({ order_id: orderId, status: 'rejected', cancellation_reason: reason }),
    })
    if (!res.ok) {
      toast.error('Failed to reject order')
    } else {
      toast.success('Order rejected')
      setRejectingOrderId(null)
      if (storeId) loadOrders(storeId)
    }
    setUpdating(prev => ({ ...prev, [orderId]: false }))
  }

  const displayed = orders.filter(o =>
    tab === 'active' ? ACTIVE_STATUSES.includes(o.status) : DONE_STATUSES.includes(o.status)
  )
  const spotOrders = displayed.filter(o => o.order_type === 'spot')
  const preOrders = displayed.filter(o => o.order_type === 'preorder')

  if (loading) return (
    <div className="p-4 space-y-3">
      {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  function renderOrder(order: FullOrder) {
    const fulfillment = (order as any).fulfillment_type as 'pickup' | 'delivery' | null
    const rawBadge = STATUS_BADGE[order.status]
    const badge = (fulfillment === 'pickup' && order.status === 'dispatched')
      ? { label: 'Ready for Pickup', className: rawBadge.className }
      : (fulfillment === 'pickup' && order.status === 'delivered')
      ? { label: 'Collected', className: rawBadge.className }
      : rawBadge
    const isUpdating = updating[order.id]
    const isPreorder = order.order_type === 'preorder'
    const deliveryTime = order.delivery_time
    const paymentMethod = (order as any).payment_method as 'online' | 'cod' | 'online_on_delivery' | null
    const paymentCollectedAt = (order as any).payment_collected_at as string | null
    const isCodFlow = paymentMethod === 'cod' || paymentMethod === 'online_on_delivery'
    const needsPaymentCollection = isCodFlow && ['dispatched', 'delivered'].includes(order.status) && !paymentCollectedAt
    // Remap action labels for pickup orders
    const pickupLabels: Record<string, string> = { 'Mark Dispatched': 'Mark Ready for Pickup', 'Mark Delivered': 'Mark Collected' }
    const baseActions = NEXT_ACTIONS[order.status] || []
    const mappedActions = fulfillment === 'pickup'
      ? baseActions.map(a => ({ ...a, label: pickupLabels[a.label] ?? a.label }))
      : baseActions
    // For COD dispatched orders, block "Mark Collected/Delivered" until payment is collected
    const actions = (isCodFlow && order.status === 'dispatched' && !paymentCollectedAt)
      ? [] // hide actions — must collect payment first
      : mappedActions

    return (
      <div key={order.id} className="bg-white rounded-2xl border p-4 space-y-3"
           style={{ borderLeftWidth: 4, borderLeftColor: orderColor(order.order_type).border }}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{order.buyer_name}</p>
              <OrderTypePill type={order.order_type} />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: orderColor(order.order_type).bg, color: orderColor(order.order_type).text }}>
                {orderRef(order.id)}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                {', '}
                {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-800">₹{order.total.toFixed(2)}</p>
            {(order as any).delivery_fee > 0 && (
              <p className="text-xs text-muted-foreground">incl. ₹{(order as any).delivery_fee.toFixed(2)} delivery</p>
            )}
          </div>
        </div>

        {/* Fulfillment + payment method badges */}
        <div className="flex flex-wrap gap-2">
          {fulfillment && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
              fulfillment === 'pickup'
                ? 'bg-blue-50 border border-blue-100'
                : 'bg-emerald-50 border border-emerald-100'
            }`}>
              <span className="text-base">{fulfillment === 'pickup' ? '🏃' : '🛵'}</span>
              <span className={`text-xs font-semibold ${fulfillment === 'pickup' ? 'text-blue-700' : 'text-emerald-800'}`}>
                {fulfillment === 'pickup' ? 'Self Pickup' : 'Delivery'}
              </span>
            </div>
          )}
          {paymentMethod && paymentMethod !== 'online' && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
              paymentMethod === 'cod'
                ? 'bg-yellow-50 border border-yellow-100'
                : 'bg-purple-50 border border-purple-100'
            }`}>
              <span className="text-base">{paymentMethod === 'cod' ? '💵' : '📱'}</span>
              <span className={`text-xs font-semibold ${paymentMethod === 'cod' ? 'text-yellow-700' : 'text-purple-700'}`}>
                {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Pay on Delivery'}
              </span>
            </div>
          )}
        </div>

        {/* Payment collection status */}
        {(paymentMethod === 'cod' || paymentMethod === 'online_on_delivery') && (
          paymentCollectedAt ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2">
              <span className="text-base">✅</span>
              <div>
                <p className="text-xs font-semibold text-green-700">Payment Collected</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(paymentCollectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                  {', '}
                  {new Date(paymentCollectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                </p>
              </div>
            </div>
          ) : (
            <div className={`rounded-xl px-3 py-2.5 border ${
              needsPaymentCollection
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-gray-50 border-gray-100'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base">{paymentMethod === 'cod' ? '💵' : '📱'}</span>
                <div className="flex-1">
                  <p className={`text-xs font-semibold ${needsPaymentCollection ? 'text-yellow-800' : 'text-gray-500'}`}>
                    {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Pay Online Before Delivery'}
                  </p>
                  {needsPaymentCollection && (
                    <p className="text-xs text-yellow-600 mt-0.5">
                      {paymentMethod === 'cod'
                        ? 'Collect cash before marking delivered'
                        : 'Waiting for buyer to pay online — cannot mark delivered yet'}
                    </p>
                  )}
                </div>
                {/* Only COD gets a manual collect button — online_on_delivery is paid by buyer */}
                {needsPaymentCollection && paymentMethod === 'cod' && (
                  <Button
                    size="sm"
                    className="text-xs bg-green-500 hover:bg-green-600 text-white h-7 px-3"
                    disabled={isUpdating}
                    onClick={() => markPaymentCollected(order.id)}
                  >
                    Mark Collected
                  </Button>
                )}
              </div>
            </div>
          )
        )}

        {/* Delivery address */}
        {(order as any).delivery_address && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              📍 Deliver to
            </p>
            <p className="text-sm font-semibold text-gray-800">
              {(order as any).delivery_name}
              {(order as any).delivery_phone && (
                <span className="font-normal text-muted-foreground"> · {(order as any).delivery_phone}</span>
              )}
            </p>
            <p className="text-sm text-gray-700">
              {[(order as any).delivery_flat, (order as any).delivery_floor ? `${(order as any).delivery_floor} floor` : null, (order as any).delivery_apartment, (order as any).delivery_address].filter(Boolean).join(', ')}
            </p>
            {(order as any).delivery_landmark && (
              <p className="text-xs text-muted-foreground">Near: {(order as any).delivery_landmark}</p>
            )}
          </div>
        )}

        {/* Delivery time banner for pre-orders */}
        {isPreorder && deliveryTime && (
          <div className="bg-pink-50 border border-pink-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-pink-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-pink-800 uppercase tracking-wide">Deliver by</p>
              <p className="text-sm font-bold text-pink-700">{fmtTime(deliveryTime)}</p>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="space-y-2">
          {order.items.map(item => (
            <div key={item.id}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{item.title} × {item.quantity}</span>
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

        {/* Default ETA preview when about to accept */}
        {(order.status === 'payment_confirmed' || order.status === 'created') && defaultEta && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-50 rounded-lg px-2.5 py-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span>Will notify buyer: delivery in <span className="font-semibold text-emerald-800">{defaultEta} min</span></span>
          </div>
        )}

        {/* ETA confirmed when accepted */}
        {order.status === 'accepted' && order.eta_minutes && (
          <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>ETA: {order.eta_minutes} min from order time</span>
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <>
            <Separator />
            {/* Rejection reason picker */}
            {rejectingOrderId === order.id ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-600">Select rejection reason:</p>
                <div className="flex flex-col gap-2">
                  {REJECTION_REASONS[order.order_type as 'spot' | 'preorder']?.map(r => (
                    <Button
                      key={r.value}
                      size="sm"
                      variant="outline"
                      className="w-full text-sm border-red-200 text-red-700 hover:bg-red-50 justify-start"
                      disabled={isUpdating}
                      onClick={() => rejectOrder(order.id, r.value)}
                    >
                      {isUpdating ? '…' : r.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                    onClick={() => setRejectingOrderId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {actions.map(action => (
                  <Button
                    key={action.status}
                    size="sm"
                    className={`flex-1 text-sm ${action.className}`}
                    disabled={isUpdating}
                    onClick={() => updateStatus(order.id, action.status)}
                  >
                    {isUpdating ? '…' : action.label}
                  </Button>
                ))}
                {(order.status === 'payment_confirmed' || order.status === 'created') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-sm border-red-200 text-red-600 hover:bg-red-50"
                    disabled={isUpdating}
                    onClick={() => setRejectingOrderId(order.id)}
                  >
                    Reject
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Orders</h1>
        <button
          onClick={() => storeId && loadOrders(storeId)}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ETA banner */}
      <Link href="/seller/account">
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700" />
            <span className="text-sm text-emerald-800">
              Default ETA:{' '}
              <span className="font-bold">
                {defaultEta ? `${defaultEta} min` : 'Not set'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-700">
            <Settings className="w-3.5 h-3.5" />
            Edit
          </div>
        </div>
      </Link>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white text-emerald-800 shadow-sm' : 'text-muted-foreground'}`}
        >
          Active
          {orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length > 0 && (
            <span className="ml-1.5 bg-emerald-700 text-white text-xs rounded-full px-1.5 py-0.5">
              {orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('done')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'done' ? 'bg-white text-gray-700 shadow-sm' : 'text-muted-foreground'}`}
        >
          Past
        </button>
      </div>

      {displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-medium">{tab === 'active' ? 'No active orders' : 'No past orders'}</p>
          {tab === 'active' && <p className="text-sm mt-1">New orders will appear here in real-time</p>}
        </div>
      )}

      <div className="space-y-3">
        {/* Spot Orders */}
        {spotOrders.length > 0 && (
          <div className="space-y-3">
            <SectionDivider label={`🔴 Spot Orders (${spotOrders.length})`} colorClass="text-emerald-800" />
            {spotOrders.map(renderOrder)}
          </div>
        )}

        {/* Pre Orders */}
        {preOrders.length > 0 && (
          <div className="space-y-3">
            <SectionDivider label={`📅 Pre Orders (${preOrders.length})`} colorClass="text-blue-700" />
            {preOrders.map(renderOrder)}
          </div>
        )}
      </div>
    </div>
  )
}
