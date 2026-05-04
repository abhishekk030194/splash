'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, ShoppingBag, IndianRupee, Percent, BarChart2, CalendarDays, X } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ── Colors ───────────────────────────────────────────────────────────────────
const SPOT_COLOR = '#3b82f6'
const PRE_COLOR  = '#ec4899'
const GREEN      = '#22c55e'
const ORANGE     = '#f97316'
const RED        = '#ef4444'
const GRAY       = '#9ca3af'
const INDIGO     = '#6366f1'
const YELLOW     = '#eab308'

const STATUS_COLOR: Record<string, string> = {
  delivered: GREEN, accepted: INDIGO, dispatched: ORANGE, created: YELLOW,
  rejected: RED, cancelled: GRAY, payment_failed: RED,
  waiting_payment: INDIGO, payment_confirmed: GREEN,
}
const STATUS_LABEL: Record<string, string> = {
  created: 'Placed', accepted: 'Accepted', waiting_payment: 'Awaiting Payment',
  payment_confirmed: 'Payment Confirmed', dispatched: 'On the way',
  delivered: 'Delivered', rejected: 'Rejected', cancelled: 'Cancelled', payment_failed: 'Payment Failed',
}
const CANCEL_LABEL: Record<string, string> = {
  buyer_cancelled: 'Buyer cancelled', stock_unavailable: 'Stock unavailable',
  delivery_not_possible: 'Delivery not possible', auto_timeout: 'Auto-timeout',
}

// ── Date/bucket helpers ───────────────────────────────────────────────────────
function toISTDate(utcIso: string): string {
  return new Date(utcIso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

type Granularity = 'day' | 'week' | 'month'

function granularity(fromISO: string, toISO: string): Granularity {
  const days = Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86_400_000)
  if (days <= 31)  return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

function bucketKey(dateISO: string, g: Granularity): string {
  if (g === 'day') return dateISO
  if (g === 'month') return dateISO.slice(0, 7)
  // week: key = Monday of that week
  const d = new Date(dateISO + 'T00:00:00')
  const day = d.getDay()           // 0 Sun … 6 Sat
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toLocaleDateString('en-CA')
}

function bucketLabel(key: string, g: Granularity): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  if (g === 'month') {
    const [y, m] = key.split('-')
    return `${MONTHS[parseInt(m) - 1]} ${y}`
  }
  const [, m, d] = key.split('-')
  if (g === 'week') return `w/${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

/** Generate all bucket keys between two ISO dates for a given granularity */
function allBuckets(fromISO: string, toISO: string, g: Granularity): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const cur = new Date(fromISO + 'T00:00:00')
  const end = new Date(toISO   + 'T00:00:00')
  while (cur <= end) {
    const iso = cur.toLocaleDateString('en-CA')
    const key = bucketKey(iso, g)
    if (!seen.has(key)) { seen.add(key); keys.push(key) }
    cur.setDate(cur.getDate() + (g === 'month' ? 28 : g === 'week' ? 7 : 1))
    // for month, jump to next month properly
    if (g === 'month') {
      cur.setDate(1)
      cur.setMonth(cur.getMonth() + 1)
    }
  }
  return keys
}

// ── Small components ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  )
}

function CustomTooltip({ active, payload, label, prefix = '', suffix = '' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border rounded-xl shadow-md px-3 py-2 text-sm">
      {label && <p className="font-semibold text-xs text-muted-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-medium">
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{suffix}
        </p>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SellerAnalyticsPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [loading, setLoading] = useState(true)

  const [allOrders, setAllOrders] = useState<any[]>([])
  const [allItems,  setAllItems]  = useState<any[]>([])

  // Date range — null means "lifetime" (no filter)
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate,   setToDate]   = useState<string>('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
    if (!profile) { setLoading(false); return }

    const { data: store } = await supabase.from('stores').select('id').eq('owner_id', profile.id).single()
    if (!store) { setLoading(false); return }

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, status, order_type, total, created_at, cancellation_reason')
      .eq('store_id', store.id)
      .order('created_at', { ascending: true })

    const orderIds = (ordersData || []).map((o: any) => o.id)
    let itemsData: any[] = []
    if (orderIds.length > 0) {
      const { data } = await supabase
        .from('order_items')
        .select('title, quantity, price, order_id')
        .in('order_id', orderIds)
      itemsData = data || []
    }

    setAllOrders(ordersData || [])
    setAllItems(itemsData)
    setLoading(false)
  }

  // ── Apply date range filter ────────────────────────────────────────────────
  const orders = useMemo(() => {
    if (!fromDate && !toDate) return allOrders
    return allOrders.filter(o => {
      const d = toISTDate(o.created_at)
      if (fromDate && d < fromDate) return false
      if (toDate   && d > toDate)   return false
      return true
    })
  }, [allOrders, fromDate, toDate])

  const filteredOrderIds = useMemo(() => new Set(orders.map((o: any) => o.id)), [orders])

  const items = useMemo(
    () => allItems.filter(i => filteredOrderIds.has(i.order_id)),
    [allItems, filteredOrderIds]
  )

  // ── Effective date range for charts ──────────────────────────────────────
  const effectiveFrom = fromDate || (orders.length ? toISTDate(orders[0].created_at) : todayIST())
  const effectiveTo   = toDate   || todayIST()
  const g             = granularity(effectiveFrom, effectiveTo)

  // ── Derived metrics ────────────────────────────────────────────────────────
  const totalOrders    = orders.length
  const totalRevenue   = orders.filter(o => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0)
  const avgOrderValue  = totalOrders ? orders.reduce((s: number, o: any) => s + (o.total || 0), 0) / totalOrders : 0
  const delivered      = orders.filter(o => o.status === 'delivered').length
  const rejected       = orders.filter(o => ['rejected','cancelled','payment_failed'].includes(o.status)).length
  const acceptanceRate = totalOrders ? Math.round((1 - rejected / totalOrders) * 100) : 0

  // ── Time-series data ───────────────────────────────────────────────────────
  const buckets = orders.length ? allBuckets(effectiveFrom, effectiveTo, g) : []

  const revenueByBucket = buckets.map(key => {
    const bo = orders.filter(o => bucketKey(toISTDate(o.created_at), g) === key && o.status === 'delivered')
    return {
      label: bucketLabel(key, g),
      spot:  Math.round(bo.filter(o => o.order_type === 'spot').reduce((s: number, o: any) => s + (o.total || 0), 0)),
      pre:   Math.round(bo.filter(o => o.order_type === 'preorder').reduce((s: number, o: any) => s + (o.total || 0), 0)),
    }
  })

  const ordersByBucket = buckets.map(key => {
    const bo = orders.filter(o => bucketKey(toISTDate(o.created_at), g) === key)
    return {
      label: bucketLabel(key, g),
      spot: bo.filter(o => o.order_type === 'spot').length,
      pre:  bo.filter(o => o.order_type === 'preorder').length,
    }
  })

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statusCounts = Object.entries(STATUS_LABEL).map(([status, label]) => ({
    status, label,
    count: orders.filter(o => o.status === status).length,
    fill: STATUS_COLOR[status] || GRAY,
  })).filter(s => s.count > 0).sort((a, b) => b.count - a.count)

  // ── Spot vs Pre split ──────────────────────────────────────────────────────
  const spotCount   = orders.filter(o => o.order_type === 'spot').length
  const preCount    = orders.filter(o => o.order_type === 'preorder').length
  const spotRevenue = orders.filter(o => o.order_type === 'spot'     && o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0)
  const preRevenue  = orders.filter(o => o.order_type === 'preorder' && o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0)

  const typePieData = [
    { name: 'Spot',      value: spotCount,              fill: SPOT_COLOR },
    { name: 'Pre-Order', value: preCount,               fill: PRE_COLOR  },
  ].filter(d => d.value > 0)

  const typeRevData = [
    { name: 'Spot',      value: Math.round(spotRevenue), fill: SPOT_COLOR },
    { name: 'Pre-Order', value: Math.round(preRevenue),  fill: PRE_COLOR  },
  ].filter(d => d.value > 0)

  // ── Cancellations ──────────────────────────────────────────────────────────
  const cancelOrders = orders.filter(o => ['rejected','cancelled','payment_failed'].includes(o.status))
  const cancelData = Object.entries(CANCEL_LABEL).map(([reason, label]) => ({
    label, count: cancelOrders.filter(o => o.cancellation_reason === reason).length,
  })).filter(d => d.count > 0)
  const unknownCancel = cancelOrders.filter(o => !o.cancellation_reason || !CANCEL_LABEL[o.cancellation_reason]).length
  if (unknownCancel > 0) cancelData.push({ label: 'Other / Rejected', count: unknownCancel })

  // ── Top items ──────────────────────────────────────────────────────────────
  const itemQtyMap: Record<string, { qty: number; revenue: number }> = {}
  for (const item of items) {
    if (!itemQtyMap[item.title]) itemQtyMap[item.title] = { qty: 0, revenue: 0 }
    itemQtyMap[item.title].qty     += item.quantity
    itemQtyMap[item.title].revenue += item.price * item.quantity
  }
  const topItems = Object.entries(itemQtyMap)
    .map(([name, { qty, revenue }]) => ({ name, qty, revenue: Math.round(revenue) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

  // ── Funnel ─────────────────────────────────────────────────────────────────
  const spotCancelled = orders.filter(o => o.order_type === 'spot'     && ['rejected','cancelled','payment_failed'].includes(o.status)).length
  const preCancelled  = orders.filter(o => o.order_type === 'preorder' && ['rejected','cancelled','payment_failed'].includes(o.status)).length
  const spotDelivered = orders.filter(o => o.order_type === 'spot'     && o.status === 'delivered').length
  const preDelivered  = orders.filter(o => o.order_type === 'preorder' && o.status === 'delivered').length

  const funnelData = [
    { name: 'Total Orders',   spot: spotCount,     pre: preCount      },
    { name: 'Delivered',      spot: spotDelivered, pre: preDelivered  },
    { name: 'Cancelled/Rej.', spot: spotCancelled, pre: preCancelled  },
  ]

  // ── X-axis tick interval for time-series charts ───────────────────────────
  const tickInterval = Math.max(0, Math.ceil(buckets.length / 8) - 1)

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  const hasFilter = !!(fromDate || toDate)
  const rangeLabel = hasFilter
    ? `${fromDate || 'Start'} → ${toDate || 'Today'}`
    : 'All time'

  return (
    <div className="p-4 pb-24 space-y-4 max-w-2xl mx-auto">

      {/* ── Header + date filter ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Analytics</h1>
        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-gray-100 px-2.5 py-1 rounded-full">
          <CalendarDays className="w-3 h-3" />
          {rangeLabel}
        </div>
      </div>

      {/* Date picker */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">From</p>
              <Input
                type="date"
                value={fromDate}
                max={toDate || todayIST()}
                onChange={e => setFromDate(e.target.value)}
                className="text-sm h-9"
              />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">To</p>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                max={todayIST()}
                onChange={e => setToDate(e.target.value)}
                className="text-sm h-9"
              />
            </div>
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => { setFromDate(''); setToDate('') }}
              >
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
          {g !== 'day' && orders.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing data grouped by {g === 'week' ? 'week' : 'month'} for this range.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Empty state ── */}
      {totalOrders === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium">{hasFilter ? 'No orders in this range' : 'No data yet'}</p>
          <p className="text-sm mt-1">
            {hasFilter ? 'Try a wider date range' : 'Analytics will populate as orders come in'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Orders"    value={totalOrders}  icon={ShoppingBag}  color={ORANGE} />
            <StatCard label="Revenue Earned"  value={`₹${Math.round(totalRevenue).toLocaleString('en-IN')}`} icon={IndianRupee} color={GREEN} />
            <StatCard label="Avg Order Value" value={`₹${Math.round(avgOrderValue)}`} icon={TrendingUp} color={INDIGO} sub="across all orders" />
            <StatCard label="Acceptance Rate" value={`${acceptanceRate}%`} icon={Percent} color={delivered > 0 ? GREEN : ORANGE} sub={`${delivered} delivered`} />
          </div>

          {/* ── Revenue over time ── */}
          <Section title={`Revenue by ${g}`}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueByBucket} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} width={48} />
                <Tooltip content={<CustomTooltip prefix="₹" />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="spot" name="Spot"      stackId="a" fill={SPOT_COLOR} radius={[0,0,0,0]} />
                <Bar dataKey="pre"  name="Pre-Order" stackId="a" fill={PRE_COLOR}  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* ── Orders over time ── */}
          <Section title={`Orders per ${g}`}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={ordersByBucket}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={25} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="spot" name="Spot"      stroke={SPOT_COLOR} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pre"  name="Pre-Order" stroke={PRE_COLOR}  strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          {/* ── Order stage breakdown ── */}
          <Section title="Orders by stage">
            <div className="space-y-2.5">
              {statusCounts.map(({ status, label, count, fill }) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: fill }} />
                  <span className="text-sm w-36 text-muted-foreground">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full transition-all"
                         style={{ width: `${(count / totalOrders) * 100}%`, backgroundColor: fill }} />
                  </div>
                  <span className="text-sm font-semibold w-7 text-right">{count}</span>
                  <span className="text-xs text-muted-foreground w-9 text-right">{Math.round((count / totalOrders) * 100)}%</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Spot vs Pre split ── */}
          <Section title="Spot vs Pre-Order">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-center text-muted-foreground mb-2">By count</p>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={typePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                         dataKey="value" paddingAngle={3}>
                      {typePieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip suffix=" orders" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-1">
                  {typePieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span>{d.name}</span>
                      </div>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-center text-muted-foreground mb-2">By revenue</p>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={typeRevData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                         dataKey="value" paddingAngle={3}>
                      {typeRevData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-1">
                  {typeRevData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span>{d.name}</span>
                      </div>
                      <span className="font-semibold">₹{d.value.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Order outcomes ── */}
          <Section title="Spot vs Pre-Order — outcomes">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={funnelData} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={95} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="spot" name="Spot"      fill={SPOT_COLOR} radius={[0,4,4,0]} />
                <Bar dataKey="pre"  name="Pre-Order" fill={PRE_COLOR}  radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* ── Cancellation reasons ── */}
          {cancelData.length > 0 && (
            <Section title="Cancellation & rejection reasons">
              <div className="space-y-2.5">
                {cancelData.map(({ label, count }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-400" />
                    <span className="text-sm flex-1 text-muted-foreground">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-red-400"
                           style={{ width: `${(count / cancelOrders.length) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Top items by qty ── */}
          {topItems.length > 0 && (
            <Section title="Top items by quantity sold">
              <ResponsiveContainer width="100%" height={Math.max(180, topItems.length * 36)}>
                <BarChart data={topItems} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip content={<CustomTooltip suffix=" sold" />} />
                  <Bar dataKey="qty" name="Qty sold" fill={ORANGE} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* ── Top items by revenue ── */}
          {topItems.length > 0 && (
            <Section title="Top items by revenue">
              <ResponsiveContainer width="100%" height={Math.max(180, topItems.length * 36)}>
                <BarChart data={[...topItems].sort((a, b) => b.revenue - a.revenue)}
                          layout="vertical" barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip content={<CustomTooltip prefix="₹" />} />
                  <Bar dataKey="revenue" name="Revenue" fill={GREEN} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
