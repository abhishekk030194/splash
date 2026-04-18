'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCart, updateQuantity, clearCart, cartTotal, Cart } from '@/lib/cart'
import { canPlaceAs, activeWindow } from '@/lib/preorder'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function CartPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [cart, setCart] = useState<Cart | null>(null)
  const [placing, setPlacing] = useState(false)

  useEffect(() => { setCart(getCart()) }, [])

  function handleQtyChange(itemId: string, orderType: 'spot' | 'preorder', qty: number) {
    const updated = updateQuantity(itemId, orderType, qty)
    setCart(updated)
  }

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return
    setPlacing(true)

    try {
      const spotItems = cart.items.filter(i => i.cartOrderType === 'spot')
      const preItems = cart.items.filter(i => i.cartOrderType === 'preorder')

      // Validate all items against their respective order types
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

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!profile) {
        toast.error('Please complete your profile first')
        return
      }

      const createdOrderIds: string[] = []

      if (spotItems.length > 0) {
        const spotTotal = spotItems.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0)
        const { data: order, error } = await supabase
          .from('orders')
          .insert({ store_id: cart.store_id, buyer_id: profile.id, status: 'created', order_type: 'spot', total: spotTotal })
          .select('id')
          .single()
        if (error || !order) { toast.error('Failed to place spot order'); return }
        await supabase.from('order_items').insert(
          spotItems.map(({ item, quantity }) => ({
            order_id: order.id, item_id: item.id, title: item.title, quantity, price: item.price,
          }))
        )
        createdOrderIds.push(order.id)
      }

      if (preItems.length > 0) {
        // Group pre-order items by their active window's delivery_time
        // Items with the same delivery time → one order
        // Items with different delivery times → separate orders
        const byDeliveryTime = new Map<string, typeof preItems>()
        for (const cartItem of preItems) {
          const win = activeWindow(cartItem.item.preorder_windows ?? [])
          const deliveryTime = win?.delivery_time ?? cartItem.item.delivery_time ?? 'unscheduled'
          if (!byDeliveryTime.has(deliveryTime)) byDeliveryTime.set(deliveryTime, [])
          byDeliveryTime.get(deliveryTime)!.push(cartItem)
        }

        for (const [deliveryTime, groupItems] of byDeliveryTime) {
          const groupTotal = groupItems.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0)
          const { data: order, error } = await supabase
            .from('orders')
            .insert({
              store_id: cart.store_id,
              buyer_id: profile.id,
              status: 'created',
              order_type: 'preorder',
              total: groupTotal,
              delivery_time: deliveryTime === 'unscheduled' ? null : deliveryTime,
            })
            .select('id')
            .single()
          if (error || !order) { toast.error('Failed to place pre-order'); return }
          await supabase.from('order_items').insert(
            groupItems.map(({ item, quantity }) => ({
              order_id: order.id, item_id: item.id, title: item.title, quantity, price: item.price,
            }))
          )
          createdOrderIds.push(order.id)
        }
      }

      clearCart()
      toast.success(createdOrderIds.length > 1 ? 'Orders placed!' : 'Order placed!')
      router.push(createdOrderIds.length === 1 ? `/orders/${createdOrderIds[0]}` : '/orders')
    } finally {
      setPlacing(false)
    }
  }

  if (!cart || cart.items.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground p-4">
      <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
      <p className="font-medium">Your cart is empty</p>
      <Link href="/">
        <Button className="mt-4 bg-orange-500 hover:bg-orange-600">Browse Kitchens</Button>
      </Link>
    </div>
  )

  const total = cartTotal(cart)
  const spotItems = cart.items.filter(i => i.cartOrderType === 'spot')
  const preItems = cart.items.filter(i => i.cartOrderType === 'preorder')
  const hasMixed = spotItems.length > 0 && preItems.length > 0

  const placeLabel = hasMixed
    ? `Place 2 Orders · ₹${total.toFixed(2)}`
    : `Place Order · ₹${total.toFixed(2)}`

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
                    ? 'text-xs bg-orange-50 text-orange-700 border-orange-200'
                    : 'text-xs bg-blue-50 text-blue-700 border-blue-200'}
                >
                  {cartOrderType === 'spot' ? 'Spot Order' : 'Pre Order'}
                </Badge>
              </div>
              <p className="text-sm text-orange-600 font-semibold">₹{(item.price * quantity).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">₹{item.price} × {quantity}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => handleQtyChange(item.id, cartOrderType, quantity - 1)} className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                {quantity === 1 ? <Trash2 className="w-3 h-3 text-orange-600" /> : <Minus className="w-3 h-3 text-orange-600" />}
              </button>
              <span className="text-sm font-semibold w-4 text-center">{quantity}</span>
              <button onClick={() => handleQtyChange(item.id, cartOrderType, quantity + 1)} className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
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
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Spot Orders</p>
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
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span className="text-orange-600">₹{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Place order */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-20">
        <div className="max-w-2xl mx-auto">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base"
            onClick={placeOrder}
            disabled={placing}
          >
            {placing ? 'Placing order…' : placeLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
