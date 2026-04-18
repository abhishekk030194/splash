export type UserRole = 'buyer' | 'seller' | 'admin'

export type OrderType = 'spot' | 'preorder' | 'both'

export type OrderStatus =
  | 'created'
  | 'accepted'
  | 'waiting_payment'
  | 'payment_confirmed'
  | 'dispatched'
  | 'delivered'
  | 'rejected'
  | 'cancelled'
  | 'payment_failed'

export interface User {
  id: string
  name: string
  phone: string
  role: UserRole
  created_at: string
}

export interface Store {
  id: string
  owner_id: string
  name: string
  description: string | null
  image_url: string | null
  is_active: boolean
  commission_pct: number
  created_at: string
}

export interface ItemGroup {
  id: string
  store_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface MenuItem {
  id: string
  store_id: string
  group_id: string | null
  title: string
  subtitle: string | null
  image_url: string | null
  price: number
  is_available: boolean
  order_type: OrderType
  available_from: string | null
  available_until: string | null
  is_combo: boolean
  combo_items: ComboItem[] | null
  delivery_time: string | null
  preorder_windows: PreorderWindow[]
  created_at: string
}

export interface PreorderWindow {
  order_open: string   // e.g. "18:00"
  order_close: string  // e.g. "21:00"
  delivery_time: string // e.g. "08:00"
}

export interface ComboItem {
  item_id: string
  title: string
  quantity: number
}

export interface Order {
  id: string
  store_id: string
  buyer_id: string
  status: OrderStatus
  order_type: OrderType
  total: number
  eta_minutes: number | null
  delivery_time: string | null
  cancellation_reason: string | null
  auto_cancel_at: string | null
  created_at: string
  store?: Store
  buyer?: User
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  item_id: string
  title: string
  quantity: number
  price: number
}

export interface Payment {
  id: string
  order_id: string
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  settled_at: string | null
  created_at: string
}

export interface Review {
  id: string
  store_id: string
  order_id: string
  buyer_id: string
  rating: number
  comment: string | null
  created_at: string
  buyer?: User
}
