import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getIp } from '@/lib/rate-limit'

// Service-role client — bypasses RLS for trusted server operations
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // 5 requests per minute per IP
  if (!rateLimit(`verify:${getIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_ids,        // our DB order UUIDs
      amount,           // total in ₹
      mode = 'initial', // 'initial' | 'delivery_payment'
    } = await req.json()

    // ── 1. Verify HMAC signature ─────────────────────────────────────────────
    const body    = `${razorpay_order_id}|${razorpay_payment_id}`
    const digest  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')

    if (digest !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // ── 2. Update orders ─────────────────────────────────────────────────────
    const supabase = adminClient()

    if (mode === 'delivery_payment') {
      // Mid-lifecycle payment: just mark payment_collected_at, don't touch status
      const { error } = await supabase
        .from('orders')
        .update({ payment_collected_at: new Date().toISOString() })
        .in('id', order_ids)
      if (error) {
        console.error('Delivery payment update error:', error)
        return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
      }
    } else {
      // Initial payment: move to payment_confirmed
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'payment_confirmed' })
        .in('id', order_ids)
        .eq('status', 'waiting_payment') // guard: only update if still pending
      if (orderError) {
        console.error('Order update error:', orderError)
        return NextResponse.json({ error: 'Failed to confirm orders' }, { status: 500 })
      }
    }

    // ── 3. Record payment against first order (or all, one row each) ─────────
    const paymentRows = order_ids.map((oid: string) => ({
      order_id:            oid,
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      status:              'paid',
      settled_at:          new Date().toISOString(),
    }))

    await supabase.from('payments').insert(paymentRows)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Payment verify error:', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
