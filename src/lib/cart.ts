import { MenuItem } from '@/types'

export interface CartItem {
  item: MenuItem
  quantity: number
  cartOrderType: 'spot' | 'preorder'
}

export interface Cart {
  store_id: string
  store_name: string
  items: CartItem[]
}

const CART_KEY = 'nook_cart'

function cartKey(itemId: string, orderType: 'spot' | 'preorder') {
  return `${itemId}::${orderType}`
}

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

export function addToCart(item: MenuItem, storeId: string, storeName: string, orderType: 'spot' | 'preorder') {
  const cart = getCart()

  if (cart && cart.store_id !== storeId) {
    const newCart: Cart = { store_id: storeId, store_name: storeName, items: [{ item, quantity: 1, cartOrderType: orderType }] }
    saveCart(newCart)
    return newCart
  }

  const key = cartKey(item.id, orderType)
  const existing = cart?.items.find(i => cartKey(i.item.id, i.cartOrderType) === key)
  if (existing) {
    const updated: Cart = {
      store_id: storeId,
      store_name: storeName,
      items: cart!.items.map(i => cartKey(i.item.id, i.cartOrderType) === key ? { ...i, quantity: i.quantity + 1 } : i),
    }
    saveCart(updated)
    return updated
  }

  const updated: Cart = {
    store_id: storeId,
    store_name: storeName,
    items: [...(cart?.items || []), { item, quantity: 1, cartOrderType: orderType }],
  }
  saveCart(updated)
  return updated
}

export function updateQuantity(itemId: string, orderType: 'spot' | 'preorder', quantity: number): Cart | null {
  const cart = getCart()
  if (!cart) return null
  const key = cartKey(itemId, orderType)
  const updated: Cart = {
    ...cart,
    items: quantity === 0
      ? cart.items.filter(i => cartKey(i.item.id, i.cartOrderType) !== key)
      : cart.items.map(i => cartKey(i.item.id, i.cartOrderType) === key ? { ...i, quantity } : i),
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
