'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCart, updateQuantity, clearCart, cartTotal, Cart } from '@/lib/cart'
import { canPlaceAs, activeWindow, windowCloseTimestamp } from '@/lib/preorder'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Check, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { LocationAutocomplete } from '@/components/LocationAutocomplete'

// Razorpay lives on window — declare it so TypeScript doesn't complain
declare global {
  interface Window { Razorpay: any }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function CartPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [cart, setCart] = useState<Cart | null>(null)
  const [placing, setPlacing] = useState(false)

  // Saved addresses
  interface SavedAddress {
    id: string; label: string; name: string; phone: string
    flat: string; floor: string | null; apartment: string | null
    area: string; landmark: string | null
  }
  const [savedAddresses, setSavedAddresses]   = useState<SavedAddress[]>([])
  const [selectedAddrId, setSelectedAddrId]   = useState<string | 'new' | null>(null)
  const [saveAddress, setSaveAddress]         = useState(true)
  const [addrLabel, setAddrLabel]             = useState<'Home' | 'Work' | 'Other'>('Home')
  const [buyerProfileId, setBuyerProfileId]   = useState<string | null>(null)

  // Fulfillment
  const [offersPickup, setOffersPickup]     = useState(false)
  const [offersDelivery, setOffersDelivery] = useState(true)
  const [fulfillment, setFulfillment]       = useState<'pickup' | 'delivery' | null>(null)
  const [deliveryFeeSpot, setDeliveryFeeSpot]         = useState(0)
  const [deliveryFeePreorder, setDeliveryFeePreorder] = useState(0)

  // Delivery address
  const [deliveryName, setDeliveryName]             = useState('')
  const [deliveryPhone, setDeliveryPhone]           = useState('')
  const [deliveryFlat, setDeliveryFlat]             = useState('')
  const [deliveryFloor, setDeliveryFloor]           = useState('')
  const [deliveryApartment, setDeliveryApartment]   = useState('')
  const [deliveryAddress, setDeliveryAddress]       = useState('')
  const [deliveryLandmark, setDeliveryLandmark]     = useState('')

  // Payment method
  const [acceptsCod, setAcceptsCod]                       = useState(false)
  const [acceptsOnlineOnDelivery, setAcceptsOnlineOnDelivery] = useState(false)
  const [paymentMethod, setPaymentMethod]                 = useState<'online' | 'cod' | 'online_on_delivery'>('online')

  useEffect(() => {
    const c = getCart()
    setCart(c)
    if (c?.store_id) loadStoreFulfillment(c.store_id)
    loadSavedAddresses()
  }, [])

  async function loadSavedAddresses() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
    if (!profile) return
    setBuyerProfileId(profile.id)
    const { data } = await supabase
      .from('delivery_addresses')
      .select('*')
      .eq('buyer_id', profile.id)
      .order('created_at', { ascending: false })
    if (data && data.length > 0) {
      setSavedAddresses(data as SavedAddress[])
      // Auto-select the first saved address
      selectSavedAddress(data[0] as SavedAddress)
      setSelectedAddrId(data[0].id)
    } else {
      setSelectedAddrId('new')
    }
  }

  function selectSavedAddress(addr: SavedAddress) {
    setDeliveryName(addr.name)
    setDeliveryPhone(addr.phone)
    setDeliveryFlat(addr.flat)
    setDeliveryFloor(addr.floor || '')
    setDeliveryApartment(addr.apartment || '')
    setDeliveryAddress(addr.area)
    setDeliveryLandmark(addr.landmark || '')
    setSelectedAddrId(addr.id)
  }

  function selectNew() {
    setDeliveryName('')
    setDeliveryPhone('')
    setDeliveryFlat('')
    setDeliveryFloor('')
    setDeliveryApartment('')
    setDeliveryAddress('')
    setDeliveryLandmark('')
    setSelectedAddrId('new')
  }

  async function loadStoreFulfillment(storeId: string) {
    const { data } = await supabase
      .from('stores')
      .select('offers_pickup, offers_delivery, delivery_fee_spot, delivery_fee_preorder, accepts_cod, accepts_online_on_delivery')
      .eq('id', storeId)
      .single()
    if (!data) return
    const pickup   = (data as any).offers_pickup   ?? false
    const delivery = (data as any).offers_delivery ?? true
    setOffersPickup(pickup)
    setOffersDelivery(delivery)
    setDeliveryFeeSpot((data as any).delivery_fee_spot     ?? 0)
    setDeliveryFeePreorder((data as any).delivery_fee_preorder ?? 0)
    setAcceptsCod((data as any).accepts_cod ?? false)
    setAcceptsOnlineOnDelivery((data as any).accepts_online_on_delivery ?? false)
    // Auto-select if only one option
    if (delivery && !pickup)   setFulfillment('delivery')
    if (pickup   && !delivery) setFulfillment('pickup')
  }

  function handleQtyChange(itemId: string, orderType: 'spot' | 'preorder', qty: number) {
    const updated = updateQuantity(itemId, orderType, qty)
    setCart(updated)
  }

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return
    if (!fulfillment) { toast.error('Please select pickup or delivery'); return }
    if (fulfillment === 'delivery') {
      if (!deliveryName.trim())  { toast.error('Please enter the recipient name'); return }
      if (!deliveryPhone.trim()) { toast.error('Please enter a contact mobile number'); return }
      if (!/^[6-9]\d{9}$/.test(deliveryPhone.trim())) { toast.error('Enter a valid 10-digit mobile number'); return }
      if (!deliveryFlat.trim())  { toast.error('Please enter flat / house number'); return }
      if (!deliveryAddress.trim()) { toast.error('Please enter the area / street'); return }
    }
    setPlacing(true)

    try {
      const spotItems = cart.items.filter(i => i.cartOrderType === 'spot')
      const preItems  = cart.items.filter(i => i.cartOrderType === 'preorder')

      // ── Validate items ─────────────────────────────────────────────────────
      const errors: string[] = []
      for (const { item } of spotItems) {
        const check = canPlaceAs(item, 'spot')
        if (!check.ok) errors.push(check.reason!)
      }
      for (const { item } of preItems) {
        const check = canPlaceAs(item, 'preorder')
        if (!check.ok) errors.push(check.reason!)
      }
      if (errors.length > 0) {
        toast.error(errors[0], { description: errors.length > 1 ? `+${errors.length - 1} more item(s)` : undefined })
        return
      }

      // ── Auth ───────────────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('id, name')
        .eq('auth_id', user.id)
        .single()

      if (!profile) { toast.error('Please complete your profile first'); return }

      // ── Create DB orders ──────────────────────────────────────────────────
      // COD/pay-on-delivery: start as 'created' (no payment step)
      // Online: start as 'waiting_payment' (Razorpay flow)
      const isCodFlow = paymentMethod === 'cod' || paymentMethod === 'online_on_delivery'
      const initialStatus = isCodFlow ? 'created' : 'waiting_payment'
      const orderIsDelivery = fulfillment === 'delivery'
      const feeSpotAmt  = orderIsDelivery && spotItems.length > 0 ? deliveryFeeSpot     : 0
      const feePreAmt   = orderIsDelivery && preItems.length  > 0 ? deliveryFeePreorder : 0
      const totalAmount = cartTotal(cart) + feeSpotAmt + feePreAmt

      const createdOrderIds: string[] = []

      if (spotItems.length > 0) {
        const itemsTotal   = spotItems.reduce((s, { item, quantity }) => s + item.price * quantity, 0)
        const fee          = orderIsDelivery ? deliveryFeeSpot : 0
        const spotTotal    = itemsTotal + fee
        const autoCancelAt = new Date(Date.now() + 1 * 60 * 1000).toISOString() // 1 min for testing
        const { data: order, error } = await supabase
          .from('orders')
          .insert({ store_id: cart.store_id, buyer_id: profile.id, status: initialStatus, order_type: 'spot', total: spotTotal, delivery_fee: fee, auto_cancel_at: autoCancelAt, fulfillment_type: fulfillment, payment_method: paymentMethod, delivery_address: orderIsDelivery ? deliveryAddress.trim() : null, delivery_name: orderIsDelivery ? deliveryName.trim() : null, delivery_phone: orderIsDelivery ? deliveryPhone.trim() : null, delivery_flat: orderIsDelivery ? deliveryFlat.trim() : null, delivery_floor: orderIsDelivery ? deliveryFloor.trim() || null : null, delivery_apartment: orderIsDelivery ? deliveryApartment.trim() || null : null, delivery_landmark: orderIsDelivery ? deliveryLandmark.trim() || null : null })
          .select('id')
          .single()
        if (error || !order) { console.error('spot order error:', error); toast.error(`Failed to create order: ${error?.message ?? 'unknown'}`); return }
        await supabase.from('order_items').insert(
          spotItems.map(({ item, quantity }) => ({
            order_id: order.id, item_id: item.id, title: item.title, quantity, price: item.price,
          }))
        )
        createdOrderIds.push(order.id)
      }

      if (preItems.length > 0) {
        const byDeliveryTime = new Map<string, { items: typeof preItems; windowClose: string | null }>()
        for (const cartItem of preItems) {
          const win          = activeWindow(cartItem.item.preorder_windows ?? [])
          const deliveryTime = win?.delivery_time ?? cartItem.item.delivery_time ?? 'unscheduled'
          if (!byDeliveryTime.has(deliveryTime)) byDeliveryTime.set(deliveryTime, { items: [], windowClose: win?.order_close ?? null })
          byDeliveryTime.get(deliveryTime)!.items.push(cartItem)
        }

        for (const [deliveryTime, { items: groupItems, windowClose }] of byDeliveryTime) {
          const itemsTotal   = groupItems.reduce((s, { item, quantity }) => s + item.price * quantity, 0)
          const fee          = orderIsDelivery ? deliveryFeePreorder : 0
          const groupTotal   = itemsTotal + fee
          const autoCancelAt = windowClose ? windowCloseTimestamp(windowClose, 60) : null
          const { data: order, error } = await supabase
            .from('orders')
            .insert({
              store_id: cart.store_id, buyer_id: profile.id, status: initialStatus,
              order_type: 'preorder', total: groupTotal, delivery_fee: fee,
              delivery_time: deliveryTime === 'unscheduled' ? null : deliveryTime,
              auto_cancel_at: autoCancelAt, fulfillment_type: fulfillment, payment_method: paymentMethod, delivery_address: orderIsDelivery ? deliveryAddress.trim() : null, delivery_name: orderIsDelivery ? deliveryName.trim() : null, delivery_phone: orderIsDelivery ? deliveryPhone.trim() : null, delivery_flat: orderIsDelivery ? deliveryFlat.trim() : null, delivery_floor: orderIsDelivery ? deliveryFloor.trim() || null : null, delivery_apartment: orderIsDelivery ? deliveryApartment.trim() || null : null, delivery_landmark: orderIsDelivery ? deliveryLandmark.trim() || null : null,
            })
            .select('id')
            .single()
          if (error || !order) { console.error('preorder error:', error); toast.error(`Failed to create pre-order: ${error?.message ?? 'unknown'}`); return }
          await supabase.from('order_items').insert(
            groupItems.map(({ item, quantity }) => ({
              order_id: order.id, item_id: item.id, title: item.title, quantity, price: item.price,
            }))
          )
          createdOrderIds.push(order.id)
        }
      }

      // ── Save address if requested ──────────────────────────────────────────
      if (orderIsDelivery && saveAddress && selectedAddrId === 'new' && buyerProfileId) {
        await supabase.from('delivery_addresses').insert({
          buyer_id: buyerProfileId,
          label: addrLabel,
          name: deliveryName.trim(),
          phone: deliveryPhone.trim(),
          flat: deliveryFlat.trim(),
          floor: deliveryFloor.trim() || null,
          apartment: deliveryApartment.trim() || null,
          area: deliveryAddress.trim(),
          landmark: deliveryLandmark.trim() || null,
        })
      }

      // ── Notify seller of new order ─────────────────────────────────────────
      const { data: { session: buyerSession } } = await supabase.auth.getSession()
      fetch('/api/orders/notify-seller', {
        method:  'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyerSession?.access_token}` },
        body:    JSON.stringify({ store_id: cart.store_id, order_count: createdOrderIds.length, total: totalAmount }),
      }).catch(() => {}) // fire and forget

      // ── COD / Pay Online on Delivery — already inserted as 'created' ───────
      if (isCodFlow) {
        clearCart()
        const label = paymentMethod === 'cod'
          ? (fulfillment === 'pickup' ? 'Pay cash when you collect.' : 'Pay cash on delivery.')
          : (fulfillment === 'pickup' ? 'Complete payment from your order page before pickup.' : 'Complete payment from your order page before delivery.')
        toast.success(createdOrderIds.length > 1 ? `Orders placed! ${label}` : `Order placed! ${label}`)
        router.push(createdOrderIds.length === 1 ? `/orders/${createdOrderIds[0]}` : '/orders')
        return
      }

      // ── Skip payment in test mode ──────────────────────────────────────────
      if (process.env.NEXT_PUBLIC_SKIP_PAYMENT === 'true') {
        await supabase.from('orders').update({ status: 'payment_confirmed' }).in('id', createdOrderIds)
        clearCart()
        toast.success(createdOrderIds.length > 1 ? 'Orders placed! (test mode)' : 'Order placed! (test mode)')
        router.push(createdOrderIds.length === 1 ? `/orders/${createdOrderIds[0]}` : '/orders')
        return
      }

      // ── Create Razorpay order ──────────────────────────────────────────────
      const rzpRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount, receipt: createdOrderIds[0] }),
      })

      if (!rzpRes.ok) {
        toast.error('Could not initiate payment. Please try again.')
        await supabase.from('orders').update({ status: 'payment_failed' }).in('id', createdOrderIds)
        return
      }

      const { rzp_order_id, amount, currency } = await rzpRes.json()

      // ── Load Razorpay script ───────────────────────────────────────────────
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        toast.error('Could not load payment gateway. Check your connection.')
        await supabase.from('orders').update({ status: 'payment_failed' }).in('id', createdOrderIds)
        return
      }

      // ── Open checkout ──────────────────────────────────────────────────────
      await new Promise<void>((resolve) => {
        const options = {
          key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount,
          currency,
          name:        'Nook',
          description: createdOrderIds.length > 1 ? `${createdOrderIds.length} orders` : 'Home Kitchen Order',
          order_id:    rzp_order_id,
          prefill: {
            name:  (profile as any).name || '',
            email: user.email || '',
          },
          method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
          theme: { color: '#f97316' },

          handler: async (response: any) => {
            const verifyRes = await fetch('/api/payment/verify', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                order_ids:           createdOrderIds,
                amount:              totalAmount,
              }),
            })

            if (verifyRes.ok) {
              clearCart()
              toast.success(createdOrderIds.length > 1 ? 'Payment done! Orders placed.' : 'Payment done! Order placed.')
              router.push(createdOrderIds.length === 1 ? `/orders/${createdOrderIds[0]}` : '/orders')
            } else {
              toast.error('Payment verification failed. Contact support if amount was deducted.')
            }
            resolve()
          },

          modal: {
            ondismiss: async () => {
              await supabase.from('orders').update({ status: 'payment_failed' }).in('id', createdOrderIds)
              toast.info('Payment cancelled. Your cart is still saved.')
              resolve()
            },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', async () => {
          await supabase.from('orders').update({ status: 'payment_failed' }).in('id', createdOrderIds)
          toast.error('Payment failed. Please try again.')
          resolve()
        })
        rzp.open()
      })

    } finally {
      setPlacing(false)
    }
  }

  if (!cart || cart.items.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground p-4">
      <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
      <p className="font-medium">Your cart is empty</p>
      <Link href="/">
        <Button className="mt-4 bg-emerald-700 hover:bg-emerald-800">Browse Kitchens</Button>
      </Link>
    </div>
  )

  const itemsTotal = cartTotal(cart)
  const spotItems  = cart.items.filter(i => i.cartOrderType === 'spot')
  const preItems   = cart.items.filter(i => i.cartOrderType === 'preorder')
  const hasMixed   = spotItems.length > 0 && preItems.length > 0

  const isDelivery = fulfillment === 'delivery'
  const feeSpot    = isDelivery && spotItems.length  > 0 ? deliveryFeeSpot    : 0
  const feePre     = isDelivery && preItems.length   > 0 ? deliveryFeePreorder : 0
  const totalFees  = feeSpot + feePre
  const grandTotal = itemsTotal + totalFees

  const isPickup = fulfillment === 'pickup'
  const placeLabel = paymentMethod === 'cod'
    ? (hasMixed ? `Place 2 Orders · ₹${grandTotal.toFixed(2)} ${isPickup ? 'cash at pickup' : 'COD'}` : `Place Order · ₹${grandTotal.toFixed(2)} ${isPickup ? 'cash at pickup' : 'COD'}`)
    : paymentMethod === 'online_on_delivery'
    ? (hasMixed ? `Place 2 Orders · ₹${grandTotal.toFixed(2)} (pay ${isPickup ? 'before pickup' : 'on delivery'})` : `Place Order · ₹${grandTotal.toFixed(2)} (pay ${isPickup ? 'before pickup' : 'on delivery'})`)
    : (hasMixed ? `Pay & Place 2 Orders · ₹${grandTotal.toFixed(2)}` : `Pay ₹${grandTotal.toFixed(2)} & Place Order`)

  return (
    <div className="p-4 pb-32">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold">Your Cart</h1>
        <Badge variant="secondary" className="ml-auto">{cart.store_name}</Badge>
      </div>

      {/* Cart items */}
      <div className="bg-white rounded-2xl border divide-y mb-4">
        {cart.items.map(({ item, quantity, cartOrderType }) => (
          <div key={`${item.id}::${cartOrderType}`} className="flex items-center gap-3 p-3">
            {item.image_url && (
              <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{item.title}</p>
                <Badge
                  variant="secondary"
                  className={cartOrderType === 'spot'
                    ? 'text-xs bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'text-xs bg-blue-50 text-blue-700 border-blue-200'}
                >
                  {cartOrderType === 'spot' ? 'Spot Order' : 'Pre Order'}
                </Badge>
              </div>
              <p className="text-sm text-emerald-800 font-semibold">₹{(item.price * quantity).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">₹{item.price} × {quantity}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => handleQtyChange(item.id, cartOrderType, quantity - 1)} className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                {quantity === 1 ? <Trash2 className="w-3 h-3 text-emerald-800" /> : <Minus className="w-3 h-3 text-emerald-800" />}
              </button>
              <span className="text-sm font-semibold w-4 text-center">{quantity}</span>
              <button onClick={() => handleQtyChange(item.id, cartOrderType, quantity + 1)} className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center">
                <Plus className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bill summary */}
      <div className="bg-white rounded-2xl border p-4 space-y-2 mb-4">
        <p className="font-semibold text-sm">Bill Summary</p>
        <Separator />
        {hasMixed ? (
          <>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Spot Orders</p>
            {spotItems.map(({ item, quantity }) => (
              <div key={`spot-${item.id}`} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.title} × {quantity}</span>
                <span>₹{(item.price * quantity).toFixed(2)}</span>
              </div>
            ))}
            <Separator />
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Pre Orders</p>
            {preItems.map(({ item, quantity }) => (
              <div key={`pre-${item.id}`} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.title} × {quantity}</span>
                <span>₹{(item.price * quantity).toFixed(2)}</span>
              </div>
            ))}
          </>
        ) : (
          cart.items.map(({ item, quantity, cartOrderType }) => (
            <div key={`${item.id}::${cartOrderType}`} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.title} × {quantity}</span>
              <span>₹{(item.price * quantity).toFixed(2)}</span>
            </div>
          ))
        )}
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Items subtotal</span>
          <span>₹{itemsTotal.toFixed(2)}</span>
        </div>
        {feeSpot > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery fee (spot)</span>
            <span>₹{feeSpot.toFixed(2)}</span>
          </div>
        )}
        {feePre > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery fee (pre-order)</span>
            <span>₹{feePre.toFixed(2)}</span>
          </div>
        )}
        {isDelivery && totalFees === 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery fee</span>
            <span className="text-green-600 font-medium">Free</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span className="text-emerald-800">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Fulfillment picker */}
      {(offersPickup || offersDelivery) && (
        <div className="bg-white rounded-2xl border p-4 space-y-3 mb-4">
          <p className="font-semibold text-sm">How would you like to receive your order?</p>
          <div className="grid grid-cols-2 gap-2">
            {offersDelivery && (
              <button
                onClick={() => setFulfillment('delivery')}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  fulfillment === 'delivery'
                    ? 'border-emerald-700 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-lg mb-1">🛵</p>
                <p className="text-sm font-semibold">Delivery</p>
                <p className="text-xs text-muted-foreground">Kitchen delivers to you</p>
              </button>
            )}
            {offersPickup && (
              <button
                onClick={() => setFulfillment('pickup')}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  fulfillment === 'pickup'
                    ? 'border-emerald-700 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-lg mb-1">🏃</p>
                <p className="text-sm font-semibold">Self Pickup</p>
                <p className="text-xs text-muted-foreground">Pick up from the kitchen</p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delivery address */}
      {fulfillment === 'delivery' && (
        <div className="bg-white rounded-2xl border p-4 space-y-3 mb-4">
          <p className="font-semibold text-sm">Delivery Details</p>

          {/* Saved address chips */}
          {savedAddresses.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {savedAddresses.map(addr => (
                <button
                  key={addr.id}
                  onClick={() => selectSavedAddress(addr)}
                  className={`flex-shrink-0 flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    selectedAddrId === addr.id
                      ? 'border-emerald-700 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span className="text-base">
                    {addr.label === 'Home' ? '🏠' : addr.label === 'Work' ? '💼' : '📍'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{addr.label}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">{addr.flat}, {addr.area}</p>
                  </div>
                  {selectedAddrId === addr.id && <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />}
                </button>
              ))}
              <button
                onClick={selectNew}
                className={`flex-shrink-0 flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                  selectedAddrId === 'new'
                    ? 'border-emerald-700 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-base">＋</span>
                <p className="text-xs font-semibold text-gray-800 whitespace-nowrap">New address</p>
              </button>
            </div>
          )}

          {/* Address form — editable whether saved or new */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Recipient name"
                value={deliveryName}
                onChange={e => setDeliveryName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mobile <span className="text-red-500">*</span></Label>
              <Input
                type="tel"
                placeholder="10-digit number"
                maxLength={10}
                value={deliveryPhone}
                onChange={e => setDeliveryPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Flat / House No. <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. 204, B-12"
                value={deliveryFlat}
                onChange={e => setDeliveryFlat(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Floor <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. 2nd, Ground"
                value={deliveryFloor}
                onChange={e => setDeliveryFloor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Apartment / Building Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              placeholder="e.g. Sobha Dream Acres, Tower 3"
              value={deliveryApartment}
              onChange={e => setDeliveryApartment(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Area / Street <span className="text-red-500">*</span></Label>
            <LocationAutocomplete
              value={deliveryAddress}
              onChange={setDeliveryAddress}
              onSelect={s => setDeliveryAddress(s.label)}
              placeholder="Society, street, locality…"
              inputClassName="border-input"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Landmark <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              placeholder="e.g. Near main gate, opposite park"
              value={deliveryLandmark}
              onChange={e => setDeliveryLandmark(e.target.value)}
            />
          </div>

          {/* Save option — only for new addresses */}
          {selectedAddrId === 'new' && (
            <div className="pt-1 space-y-2">
              <button
                onClick={() => setSaveAddress(v => !v)}
                className="flex items-center gap-2 text-sm"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${saveAddress ? 'bg-emerald-700 border-emerald-700' : 'border-gray-300'}`}>
                  {saveAddress && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-sm text-gray-700">Save this address for future orders</span>
              </button>
              {saveAddress && (
                <div className="flex gap-2 pl-6">
                  {(['Home', 'Work', 'Other'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setAddrLabel(l)}
                      className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                        addrLabel === l
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {l === 'Home' ? '🏠 Home' : l === 'Work' ? '💼 Work' : '📍 Other'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payment method picker */}
      <div className="bg-white rounded-2xl border p-4 space-y-3 mb-4">
        <p className="font-semibold text-sm">How would you like to pay?</p>
        <div className="space-y-2">
          <button
            onClick={() => setPaymentMethod('online')}
            className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              paymentMethod === 'online' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-xl">💳</span>
            <div>
              <p className="text-sm font-semibold">Pay Now (UPI)</p>
              <p className="text-xs text-muted-foreground">Pay instantly via any UPI app</p>
            </div>
            {paymentMethod === 'online' && <span className="ml-auto text-emerald-700 text-lg">●</span>}
          </button>

          {acceptsCod && (
            <button
              onClick={() => setPaymentMethod('cod')}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                paymentMethod === 'cod' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">💵</span>
              <div>
                <p className="text-sm font-semibold">{fulfillment === 'pickup' ? 'Cash at Pickup' : 'Cash on Delivery'}</p>
                <p className="text-xs text-muted-foreground">{fulfillment === 'pickup' ? 'Pay cash when you collect your order' : 'Pay cash when your order arrives'}</p>
              </div>
              {paymentMethod === 'cod' && <span className="ml-auto text-emerald-700 text-lg">●</span>}
            </button>
          )}

          {acceptsOnlineOnDelivery && (
            <button
              onClick={() => setPaymentMethod('online_on_delivery')}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                paymentMethod === 'online_on_delivery' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">📱</span>
              <div>
                <p className="text-sm font-semibold">{fulfillment === 'pickup' ? 'Pay Online Before Pickup' : 'Pay Online Before Delivery'}</p>
                <p className="text-xs text-muted-foreground">{fulfillment === 'pickup' ? 'Pay via UPI/card anytime before you collect' : 'Pay via UPI/card anytime before delivery'}</p>
              </div>
              {paymentMethod === 'online_on_delivery' && <span className="ml-auto text-emerald-700 text-lg">●</span>}
            </button>
          )}
        </div>
      </div>

      {/* Payment note */}
      {paymentMethod === 'online' && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 flex items-center gap-2 mb-4">
          <span className="text-lg">🔒</span>
          <p className="text-xs text-green-700">Secure UPI payment via Razorpay. Your order is confirmed only after payment.</p>
        </div>
      )}
      {paymentMethod === 'cod' && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2.5 flex items-center gap-2 mb-4">
          <span className="text-lg">💵</span>
          <p className="text-xs text-yellow-700">{fulfillment === 'pickup' ? 'Your order will be placed immediately. Please keep cash ready when you collect.' : 'Your order will be placed immediately. Please keep cash ready when it arrives.'}</p>
        </div>
      )}
      {paymentMethod === 'online_on_delivery' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 flex items-center gap-2 mb-4">
          <span className="text-lg">📱</span>
          <p className="text-xs text-blue-700">{fulfillment === 'pickup' ? 'Order placed immediately. Pay online anytime after kitchen accepts — must pay before you collect.' : 'Order placed immediately. Pay online anytime after kitchen accepts — must pay before delivery.'}</p>
        </div>
      )}

      {/* Place order */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-20">
        <div className="max-w-2xl mx-auto">
          <Button
            className="w-full bg-emerald-700 hover:bg-emerald-800 h-12 text-base"
            onClick={placeOrder}
            disabled={placing}
          >
            {placing ? 'Opening payment…' : placeLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
