'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addToCart, updateQuantity, getCart, cartCount, Cart } from '@/lib/cart'
import { canOrderAsSpot, canOrderAsPreorder, nextWindowLabel } from '@/lib/preorder'
import { Store, MenuItem, ItemGroup } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Minus, Plus, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

export default function StorePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [store, setStore] = useState<Store | null>(null)
  const [groups, setGroups] = useState<ItemGroup[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStore()
    setCart(getCart())
  }, [id])

  async function loadStore() {
    const [{ data: s }, { data: g }, { data: i }] = await Promise.all([
      supabase.from('stores').select('*').eq('id', id).single(),
      supabase.from('item_groups').select('*').eq('store_id', id).order('sort_order'),
      supabase.from('menu_items').select('*').eq('store_id', id).eq('is_available', true).order('created_at'),
    ])
    setStore(s)
    setGroups(g || [])
    setItems(i || [])
    setLoading(false)
  }

  function getQuantity(itemId: string, orderType: 'spot' | 'preorder') {
    return cart?.items.find(i => i.item.id === itemId && i.cartOrderType === orderType)?.quantity || 0
  }

  function handleAdd(item: MenuItem, orderType: 'spot' | 'preorder') {
    if (!store) return
    const existing = getCart()
    if (existing && existing.store_id !== store.id) {
      if (!confirm(`Your cart has items from ${existing.store_name}. Start a new cart from ${store.name}?`)) return
    }
    const updated = addToCart(item, store.id, store.name, orderType)
    setCart(updated)
    toast.success(`${item.title} added as ${orderType === 'spot' ? 'Spot Order' : 'Pre Order'}`)
  }

  function handleQtyChange(itemId: string, orderType: 'spot' | 'preorder', qty: number) {
    const updated = updateQuantity(itemId, orderType, qty)
    setCart(updated)
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
      <div className="h-8 bg-gray-100 rounded animate-pulse w-1/2" />
    </div>
  )

  if (!store) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
      <p>Kitchen not found</p>
      <Link href="/" className="text-emerald-700 underline mt-2 text-sm">← Back home</Link>
    </div>
  )

  const ungrouped = items.filter(i => !i.group_id)
  const cartItemCount = cart ? cartCount(cart) : 0

  return (
    <div className="pb-32">
      {/* Store header */}
      <div className="relative">
        <div className="h-40 bg-emerald-100 flex items-center justify-center overflow-hidden">
          {store.image_url
            ? <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
            : <span className="text-6xl">🍳</span>
          }
        </div>
        <button onClick={() => router.back()} className="absolute top-4 left-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow">
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-xl font-bold">{store.name}</h1>
          <Badge className="bg-green-500 text-white">Open</Badge>
        </div>
        {store.description && <p className="text-sm text-muted-foreground mb-1">{store.description}</p>}
        {((store as any).open_from && (store as any).open_until) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> {(store as any).open_from?.slice(0,5)} – {(store as any).open_until?.slice(0,5)}
          </p>
        )}
      </div>

      <div className="px-4 space-y-6">
        {ungrouped.length > 0 && (
          <div className="space-y-2">
            {ungrouped.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                getQuantity={getQuantity}
                onAdd={orderType => handleAdd(item, orderType)}
                onQtyChange={handleQtyChange}
              />
            ))}
          </div>
        )}

        {groups.map(group => {
          const groupItems = items.filter(i => i.group_id === group.id)
          if (groupItems.length === 0) return null
          return (
            <div key={group.id}>
              <h2 className="font-semibold text-sm uppercase tracking-wide text-emerald-800 mb-2">{group.name}</h2>
              <div className="space-y-2">
                {groupItems.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    getQuantity={getQuantity}
                    onAdd={orderType => handleAdd(item, orderType)}
                    onQtyChange={handleQtyChange}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {cartItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-20">
          <div className="max-w-2xl mx-auto">
            <Link href="/cart">
              <Button className="w-full bg-emerald-700 hover:bg-emerald-800 h-12">
                <ShoppingCart className="w-4 h-4 mr-2" />
                View Cart · {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderTypeTag({ spotAvail, preAvail }: { spotAvail: boolean; preAvail: boolean }) {
  if (spotAvail && preAvail) {
    return (
      <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
        Spot &amp; Pre Order
      </Badge>
    )
  }
  if (spotAvail) {
    return (
      <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
        Spot Order
      </Badge>
    )
  }
  if (preAvail) {
    return (
      <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
        Pre Order
      </Badge>
    )
  }
  return null
}


function ItemRow({ item, getQuantity, onAdd, onQtyChange }: {
  item: MenuItem
  getQuantity: (itemId: string, orderType: 'spot' | 'preorder') => number
  onAdd: (orderType: 'spot' | 'preorder') => void
  onQtyChange: (id: string, orderType: 'spot' | 'preorder', qty: number) => void
}) {
  const spotAvail = canOrderAsSpot(item)
  const preAvail = canOrderAsPreorder(item)
  const neitherAvail = !spotAvail && !preAvail
  const closedLabel = neitherAvail ? nextWindowLabel(item) : null

  const spotQty = getQuantity(item.id, 'spot')
  const preQty = getQuantity(item.id, 'preorder')

  return (
    <div className={`bg-white rounded-2xl border p-3 flex items-start gap-3 ${neitherAvail ? 'opacity-60' : ''}`}>
      {item.image_url && (
        <img src={item.image_url} alt={item.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{item.title}</p>
          {item.is_combo && <Badge variant="secondary" className="text-xs">Combo</Badge>}
        </div>
        {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>}
        <p className="text-sm font-semibold text-emerald-800 mt-1">₹{item.price}</p>
        <div className="mt-1">
          <OrderTypeTag spotAvail={spotAvail} preAvail={preAvail} />
          {closedLabel && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />{closedLabel}
            </p>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col gap-2 items-end pt-0.5">
        {neitherAvail ? (
          <Button size="sm" variant="outline" className="border-gray-300 text-gray-400 cursor-not-allowed h-7 px-3 text-xs" disabled>
            Closed
          </Button>
        ) : (
          <>
            {spotAvail && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xs font-medium text-emerald-800">Spot</span>
                {spotQty === 0 ? (
                  <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-800 hover:bg-emerald-50 h-7 px-3 text-xs" onClick={() => onAdd('spot')}>
                    Add
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onQtyChange(item.id, 'spot', spotQty - 1)} className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Minus className="w-3 h-3 text-emerald-800" />
                    </button>
                    <span className="text-sm font-semibold w-4 text-center">{spotQty}</span>
                    <button onClick={() => onQtyChange(item.id, 'spot', spotQty + 1)} className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center">
                      <Plus className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
              </div>
            )}
            {preAvail && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xs font-medium text-blue-600">Pre Order</span>
                {preQty === 0 ? (
                  <Button size="sm" variant="outline" className="border-blue-400 text-blue-600 hover:bg-blue-50 h-7 px-3 text-xs" onClick={() => onAdd('preorder')}>
                    Add
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onQtyChange(item.id, 'preorder', preQty - 1)} className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <Minus className="w-3 h-3 text-blue-600" />
                    </button>
                    <span className="text-sm font-semibold w-4 text-center">{preQty}</span>
                    <button onClick={() => onQtyChange(item.id, 'preorder', preQty + 1)} className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <Plus className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
