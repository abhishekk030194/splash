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

  const svc  = createSupabase(URL, SVC)
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  await svc.from('users').upsert(
    { auth_id: user.id, name, role: 'buyer' },
    { onConflict: 'auth_id', ignoreDuplicates: true },
  )

  return NextResponse.json({ success: true })
}
