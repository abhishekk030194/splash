import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUYER_MESSAGES: Record<string, { title: string; body: string }> = {
  accepted:   { title: '✅ Order Accepted!',      body: 'Your order has been accepted and is being prepared.' },
  dispatched: { title: '🛵 Order On Its Way!',    body: 'Your order has been dispatched. Get ready!' },
  delivered:  { title: '🍱 Order Delivered!',     body: 'Your order has been delivered. Enjoy your meal!' },
  rejected:   { title: '❌ Order Rejected',        body: 'Sorry, your order was rejected by the kitchen.' },
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify seller identity
  const { data: { user } } = await createSupabase(URL, ANON).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createSupabase(URL, SVC)

  const { data: sellerProfile } = await svc.from('users').select('id').eq('auth_id', user.id).single()
  if (!sellerProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { order_id, status, eta_minutes, cancellation_reason } = body

  if (!order_id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify seller owns the store for this order
  const { data: order } = await svc
    .from('orders')
    .select('id, buyer_id, store_id, total, stores(owner_id)')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if ((order.stores as any)?.owner_id !== sellerProfile.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Update status
  const update: any = { status }
  if (eta_minutes)          update.eta_minutes = eta_minutes
  if (cancellation_reason)  update.cancellation_reason = cancellation_reason

  const { error } = await svc.from('orders').update(update).eq('id', order_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send push notification to buyer
  const msg = BUYER_MESSAGES[status]
  if (msg && order.buyer_id) {
    await sendPush(order.buyer_id, msg.title, msg.body, `/orders/${order_id}`)
  }

  return NextResponse.json({ success: true })
}
