'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, OrderStatus } from '@/types'
import { orderColor, orderRef } from '@/lib/order-color'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Clock, RefreshCw } from 'lucide-react'

const NEXT_ACTIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string; className: string }[]>> = {
  created:           [{ status: 'accepted', label: 'Accept', className: 'bg-green-500 hover:bg-green-600 text-white' },
                      { status: 'rejected', label: 'Reject', className: 'bg-red-100 hover:bg-red-200 text-red-700' }],
  accepted:          [{ status: 'dispatched', label: 'Mark Dispatched', className: 'bg-orange-500 hover:bg-orange-600 text-white' }],
  dispatched:        [{ status: 'delivered', label: 'Mark Delivered', className: 'bg-green-500 hover:bg-green-600 text-white' }],
  waiting_payment:   [{ status: 'payment_confirmed', label: 'Confirm Payment', className: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
                      { status: 'payment_failed',    label: 'Payment Failed', className: 'bg-red-100 hover:bg-red-200 text-red-700' }],
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  created:           { label: 'New',               className: 'bg-yellow-100 text-yellow-800' },
  accepted:          { label: 'Accepted',           className: 'bg-blue-100 text-blue-800' },
  waiting_payment:   { label: 'Awaiting Payment',   className: 'bg-purple-100 text-purple-800' },
  payment_confirmed: { label: 'Paid',               className: 'bg-indigo-100 text-indigo-800' },
  dispatched:        { label: 'Dispatched',         className: 'bg-orange-100 text-orange-800' },
  delivered:         { label: 'Delivered',          className: 'bg-green-100 text-green-800' },
  rejected:          { label: 'Rejected',           className: 'bg-red-100 text-red-800' },
  cancelled:         { label: 'Cancelled',          className: 'bg-gray-100 text-gray-600' },
  payment_failed:    { label: 'Payment Failed',     className: 'bg-red-100 text-red-800' },
}

const ACTIVE_STATUSES: OrderStatus[] = ['created', 'accepted', 'waiting_payment', 'payment_confirmed', 'dispatched']
const DONE_STATUSES: OrderStatus[] = ['delivered', 'rejected', 'cancelled', 'payment_failed']

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
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [etaInputs, setEtaInputs] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
    if (!profile) { setLoading(false); return }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', profile.id).single()
    if (!store) { setLoading(false); return }

    setStoreId(store.id)
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
    const update: any = { status: newStatus }
    if (etaInputs[orderId] && newStatus === 'accepted') {
      const eta = parseInt(etaInputs[orderId])
      if (!isNaN(eta) && eta > 0) update.eta_minutes = eta
    }
    const { error } = await supabase.from('orders').update(update).eq('id', orderId)
    if (error) {
      toast.error('Failed to update order')
    } else {
      toast.success(`Order ${STATUS_BADGE[newStatus].label.toLowerCase()}`)
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
    const badge = STATUS_BADGE[order.status]
    const actions = NEXT_ACTIONS[order.status] || []
    const isUpdating = updating[order.id]
    const isPreorder = order.order_type === 'preorder'

    // Collect unique delivery times across this order's items
    const deliveryTimes = [...new Set(
      order.items.map(i => resolveDeliveryTime(menuItemsById[i.item_id], order.created_at)).filter(Boolean)
    )] as string[]

    return (
      <div key={order.id} className="bg-white rounded-2xl border p-4 space-y-3"
           style={{ borderLeftWidth: 4, borderLeftColor: orderColor(order.id).border }}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{order.buyer_name}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: orderColor(order.id).bg, color: orderColor(order.id).text }}>
                {orderRef(order.id)}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
          </div>
          <p className="text-sm font-bold text-orange-600">₹{order.total.toFixed(2)}</p>
        </div>

        {/* Delivery time banner for pre-orders */}
        {isPreorder && deliveryTimes.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-0.5">Delivery Time</p>
              {deliveryTimes.map(t => (
                <p key={t} className="text-sm font-bold text-blue-700">{fmtTime(t)}</p>
              ))}
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

        {/* ETA input when accepting */}
        {order.status === 'created' && (
          <div>
            <Separator className="my-2" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="number"
                placeholder="ETA (minutes)"
                className="h-8 text-sm"
                value={etaInputs[order.id] || ''}
                onChange={(e: any) => setEtaInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
              />
            </div>
          </div>
        )}

        {/* ETA display when accepted */}
        {order.status === 'accepted' && order.eta_minutes && (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <Clock className="w-3.5 h-3.5" />
            <span>ETA: {order.eta_minutes} min</span>
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <>
            <Separator />
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
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Orders</h1>
        <button
          onClick={() => storeId && loadOrders(storeId)}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white text-orange-600 shadow-sm' : 'text-muted-foreground'}`}
        >
          Active
          {orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length > 0 && (
            <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">
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
            <SectionDivider label={`🔴 Spot Orders (${spotOrders.length})`} colorClass="text-orange-700" />
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
