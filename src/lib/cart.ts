import { MenuItem } from '@/types'

export interface CartItem {
  item: MenuItem
  quantity: number
}

export interface Cart {
  store_id: string
  store_name: string
  items: CartItem[]
}

const CART_KEY = 'splash_cart'

export function getCart(): Cart | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveCart(cart: Cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

export function clearCart() {
  localStorage.removeItem(CART_KEY)
}

export function addToCart(item: MenuItem, storeId: string, storeName: string) {
  const cart = getCart()

  // If cart has items from a different store, start fresh
  if (cart && cart.store_id !== storeId) {
    const newCart: Cart = { store_id: storeId, store_name: storeName, items: [{ item, quantity: 1 }] }
    saveCart(newCart)
    return newCart
  }

  const existing = cart?.items.find(i => i.item.id === item.id)
  if (existing) {
    const updated: Cart = {
      store_id: storeId,
      store_name: storeName,
      items: cart!.items.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i),
    }
    saveCart(updated)
    return updated
  }

  const updated: Cart = {
    store_id: storeId,
    store_name: storeName,
    items: [...(cart?.items || []), { item, quantity: 1 }],
  }
  saveCart(updated)
  return updated
}

export function updateQuantity(itemId: string, quantity: number): Cart | null {
  const cart = getCart()
  if (!cart) return null
  const updated: Cart = {
    ...cart,
    items: quantity === 0
      ? cart.items.filter(i => i.item.id !== itemId)
      : cart.items.map(i => i.item.id === itemId ? { ...i, quantity } : i),
  }
  if (updated.items.length === 0) { clearCart(); return null }
  saveCart(updated)
  return updated
}

export function cartTotal(cart: Cart) {
  return cart.items.reduce((sum, i) => sum + i.item.price * i.quantity, 0)
}

export function cartCount(cart: Cart) {
  return cart.items.reduce((sum, i) => sum + i.quantity, 0)
}
