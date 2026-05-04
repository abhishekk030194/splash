import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { rateLimit, getIp } from '@/lib/rate-limit'

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: NextRequest) {
  // 5 requests per minute per IP
  if (!rateLimit(`create-order:${getIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  try {
    const { amount, receipt } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const order = await rzp.orders.create({
      amount:   Math.round(amount * 100), // convert ₹ to paise
      currency: 'INR',
      receipt:  receipt ?? 'nook_order',
    })

    return NextResponse.json({
      rzp_order_id: order.id,
      amount:       order.amount,
      currency:     order.currency,
    })
  } catch (err: any) {
    console.error('Razorpay create-order error:', err)
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
  }
}
