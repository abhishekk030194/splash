'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCart, updateQuantity, clearCart, cartTotal, Cart } from '@/lib/cart'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function CartPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [cart, setCart] = useState<Cart | null>(null)
  const [orderType, setOrderType] = useState<'spot' | 'preorder'>('spot')
  const [placing, setPlacing] = useState(false)

  useEffect(() => { setCart(getCart()) }, [])

  function handleQtyChange(itemId: string, qty: number) {
    const updated = updateQuantity(itemId, qty)
    setCart(updated)
  }

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return
    setPlacing(true)

    try {
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

      const total = cartTotal(cart)

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: cart.store_id,
          buyer_id: profile.id,
          status: 'created',
          order_type: orderType,
          total,
        })
        .select('id')
        .single()

      if (orderError || !order) {
        toast.error('Failed to place order')
        return
      }

      // Insert order items
      const orderItems = cart.items.map(i => ({
        order_id: order.id,
        item_id: i.item.id,
        title: i.item.title,
        quantity: i.quantity,
        price: i.item.price,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) {
        toast.error('Failed to save order items')
        return
      }

      clearCart()
      toast.success('Order placed!')
      router.push(`/orders/${order.id}`)
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

  return (
    <div className="p-4 pb-32">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold">Your Cart</h1>
        <Badge variant="secondary" className="ml-auto">{cart.store_name}</Badge>
      </div>

      {/* Order type */}
      <div className="bg-white rounded-2xl border p-4 mb-4">
        <Label className="text-sm font-semibold mb-2 block">Order Type</Label>
        <Select value={orderType} onValueChange={v => setOrderType(v as 'spot' | 'preorder')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spot">🔴 Spot Order — order now, get it soon</SelectItem>
            <SelectItem value="preorder">📅 Pre-order — schedule for later</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cart items */}
      <div className="bg-white rounded-2xl border divide-y mb-4">
        {cart.items.map(({ item, quantity }) => (
          <div key={item.id} className="flex items-center gap-3 p-3">
            {item.image_url && (
              <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{item.title}</p>
              <p className="text-sm text-orange-600 font-semibold">₹{(item.price * quantity).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">₹{item.price} × {quantity}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => handleQtyChange(item.id, quantity - 1)} className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                {quantity === 1 ? <Trash2 className="w-3 h-3 text-orange-600" /> : <Minus className="w-3 h-3 text-orange-600" />}
              </button>
              <span className="text-sm font-semibold w-4 text-center">{quantity}</span>
              <button onClick={() => handleQtyChange(item.id, quantity + 1)} className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
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
        {cart.items.map(({ item, quantity }) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.title} × {quantity}</span>
            <span>₹{(item.price * quantity).toFixed(2)}</span>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span className="text-orange-600">₹{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Place order */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <div className="max-w-2xl mx-auto">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base"
            onClick={placeOrder}
            disabled={placing}
          >
            {placing ? 'Placing order…' : `Place Order · ₹${total.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
