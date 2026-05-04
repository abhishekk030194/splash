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
  // Location & delivery
  lat: number | null
  lng: number | null
  society_name: string | null
  delivery_scope: 'society_only' | 'radius'
  delivery_radius_km: number | null
  // Fulfillment
  offers_pickup: boolean
  offers_delivery: boolean
  delivery_fee_spot: number
  delivery_fee_preorder: number
  // Payment methods
  accepts_cod: boolean
  accepts_online_on_delivery: boolean
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
  fulfillment_type: 'pickup' | 'delivery' | null
  delivery_fee: number
  payment_method: 'online' | 'cod' | 'online_on_delivery' | null
  payment_collected_at: string | null
  delivery_address: string | null
  delivery_name: string | null
  delivery_phone: string | null
  delivery_flat: string | null
  delivery_floor: string | null
  delivery_apartment: string | null
  delivery_landmark: string | null
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
