'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { orderRef } from '@/lib/order-color'
import { Loader2 } from 'lucide-react'

interface Stats {
  totalStores: number
  activeStores: number
  totalUsers: number
  totalBuyers: number
  totalSellers: number
  ordersToday: number
  ordersThisMonth: number
  gmvToday: number
  gmvThisMonth: number
  gmvAllTime: number
  pendingOrders: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    // Auth + role check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
    if (!profile || profile.role !== 'admin') { router.push('/'); return }

    await Promise.all([loadStats(), loadRecentOrders()])
    setLoading(false)
  }

  async function loadStats() {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [stores, users, ordersToday, ordersMonth, ordersAll, pending] = await Promise.all([
      supabase.from('stores').select('id, is_active'),
      supabase.from('users').select('id, role'),
      supabase.from('orders').select('id, total').gte('created_at', todayStart).not('status', 'in', '(cancelled,rejected,payment_failed)'),
      supabase.from('orders').select('id, total').gte('created_at', monthStart).not('status', 'in', '(cancelled,rejected,payment_failed)'),
      supabase.from('orders').select('id, total').not('status', 'in', '(cancelled,rejected,payment_failed)'),
      supabase.from('orders').select('id').in('status', ['created', 'payment_confirmed', 'accepted', 'dispatched']),
    ])

    const allStores  = stores.data  || []
    const allUsers   = users.data   || []
    const todayOrds  = ordersToday.data  || []
    const monthOrds  = ordersMonth.data  || []
    const allOrds    = ordersAll.data    || []

    setStats({
      totalStores:    allStores.length,
      activeStores:   allStores.filter(s => s.is_active).length,
      totalUsers:     allUsers.length,
      totalBuyers:    allUsers.filter(u => u.role === 'buyer').length,
      totalSellers:   allUsers.filter(u => u.role === 'seller').length,
      ordersToday:    todayOrds.length,
      ordersThisMonth: monthOrds.length,
      gmvToday:       todayOrds.reduce((s, o) => s + o.total, 0),
      gmvThisMonth:   monthOrds.reduce((s, o) => s + o.total, 0),
      gmvAllTime:     allOrds.reduce((s, o) => s + o.total, 0),
      pendingOrders:  pending.data?.length || 0,
    })
  }

  async function loadRecentOrders() {
    const { data } = await supabase
      .from('orders')
      .select('id, status, total, order_type, created_at, fulfillment_type, payment_method, store:stores(name), buyer:users(name)')
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentOrders(data || [])
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  if (!stats) return null

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-lg font-bold">Dashboard</h1>

      {/* GMV */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="GMV Today"       value={`₹${fmt(stats.gmvToday)}`}      sub={`${stats.ordersToday} orders`}       color="orange" />
        <StatCard label="GMV This Month"  value={`₹${fmt(stats.gmvThisMonth)}`}  sub={`${stats.ordersThisMonth} orders`}   color="blue"   />
        <StatCard label="GMV All Time"    value={`₹${fmt(stats.gmvAllTime)}`}     sub="total"                               color="green"  />
      </div>

      {/* Pending */}
      {stats.pendingOrders > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-yellow-800">{stats.pendingOrders} active order{stats.pendingOrders !== 1 ? 's' : ''}</p>
            <p className="text-xs text-yellow-600">In progress across all kitchens</p>
          </div>
          <span className="text-2xl">🔥</span>
        </div>
      )}

      {/* Stores + Users */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Kitchens</p>
          <p className="text-2xl font-bold">{stats.totalStores}</p>
          <p className="text-xs text-green-600 mt-1">🟢 {stats.activeStores} active</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Users</p>
          <p className="text-2xl font-bold">{stats.totalUsers}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.totalBuyers} buyers · {stats.totalSellers} sellers</p>
        </div>
      </div>

      {/* Recent orders */}
      <div>
        <p className="font-semibold text-sm mb-3">Recent Orders</p>
        <div className="space-y-2">
          {recentOrders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl border p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-gray-500">{orderRef(order.id)}</span>
                  <StatusPill status={order.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {(order.store as any)?.name} · {(order.buyer as any)?.name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-emerald-800">₹{order.total.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function fmt(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `${(n / 1000).toFixed(1)}K`
  return n.toFixed(0)
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    orange: 'bg-emerald-50 border-emerald-100',
    blue:   'bg-blue-50 border-blue-100',
    green:  'bg-green-50 border-green-100',
  }
  return (
    <div className={`rounded-2xl border p-3 ${colors[color]}`}>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    created:           'bg-yellow-100 text-yellow-700',
    payment_confirmed: 'bg-indigo-100 text-indigo-700',
    accepted:          'bg-blue-100 text-blue-700',
    dispatched:        'bg-emerald-100 text-emerald-800',
    delivered:         'bg-green-100 text-green-700',
    cancelled:         'bg-gray-100 text-gray-500',
    rejected:          'bg-red-100 text-red-700',
    payment_failed:    'bg-red-100 text-red-700',
    waiting_payment:   'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
