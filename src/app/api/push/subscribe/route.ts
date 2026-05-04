import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await createSupabase(URL, ANON).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const svc = createSupabase(URL, SVC)

  // Get user profile id
  const { data: profile } = await svc.from('users').select('id').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Upsert subscription (one per endpoint)
  await svc.from('push_subscriptions').upsert({
    user_id:      profile.id,
    endpoint:     subscription.endpoint,
    p256dh:       subscription.keys.p256dh,
    auth:         subscription.keys.auth,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ success: true })
}
