import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await createSupabase(URL, ANON).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { store_id, order_count, total } = await req.json()
  if (!store_id) return NextResponse.json({ error: 'Missing store_id' }, { status: 400 })

  const svc = createSupabase(URL, SVC)
  const { data: store } = await svc.from('stores').select('owner_id, name').eq('id', store_id).single()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const title = order_count > 1 ? `🍱 ${order_count} New Orders!` : '🍱 New Order!'
  const body  = `₹${total.toFixed(0)} — check your orders tab`

  await sendPush(store.owner_id, title, body, '/seller/orders')

  return NextResponse.json({ success: true })
}
