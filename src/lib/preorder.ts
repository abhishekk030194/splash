import { MenuItem, PreorderWindow } from '@/types'

const IST = 'Asia/Kolkata'

/** Returns current IST time as "HH:MM" (24h) */
function nowIST(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  })
}

/** Compare two "HH:MM" strings. Returns negative if a < b. */
function cmpTime(a: string, b: string): number {
  return a.localeCompare(b)
}

/** Format "HH:MM" → "h:MM AM/PM" */
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Returns the active preorder window if now (IST) falls within it, else null.
 */
export function activeWindow(windows: PreorderWindow[]): PreorderWindow | null {
  const now = nowIST()
  return windows.find(w => cmpTime(now, w.order_open) >= 0 && cmpTime(now, w.order_close) < 0) ?? null
}

/**
 * Converts a preorder window's order_close time (IST "HH:MM") to a UTC ISO timestamp
 * for today, then adds bufferMinutes. Used to set auto_cancel_at on preorders.
 */
export function windowCloseTimestamp(closeHHMM: string, bufferMinutes = 60): string {
  const [h, m] = closeHHMM.split(':').map(Number)
  const IST_OFFSET_MS = 330 * 60 * 1000
  const now = new Date()
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)
  const y = istNow.getUTCFullYear()
  const mo = istNow.getUTCMonth()
  const d = istNow.getUTCDate()
  const closeIST = new Date(Date.UTC(y, mo, d, h, m, 0, 0))
  const closeUTC = new Date(closeIST.getTime() - IST_OFFSET_MS)
  return new Date(closeUTC.getTime() + bufferMinutes * 60 * 1000).toISOString()
}

/**
 * Returns the next upcoming window today, or null if none.
 */
export function nextWindow(windows: PreorderWindow[]): PreorderWindow | null {
  const now = nowIST()
  const upcoming = windows
    .filter(w => cmpTime(w.order_open, now) > 0)
    .sort((a, b) => cmpTime(a.order_open, b.order_open))
  return upcoming[0] ?? null
}

/**
 * Can this item be added to the cart at all right now?
 * - spot  → always yes
 * - both  → always yes (spot ordering is always open; preorder window checked at checkout)
 * - preorder → only if inside an active preorder window
 */
export function isOrderable(item: MenuItem): boolean {
  if (item.order_type === 'spot' || item.order_type === 'both') return true
  return activeWindow(item.preorder_windows ?? []) !== null
}

/**
 * Can this item be placed under the given order type?
 * Called at checkout before submitting the order.
 *
 * spot order:    item must support spot    (order_type === 'spot' | 'both')
 * preorder:      item must support preorder (order_type === 'preorder' | 'both')
 *                AND current IST time must be inside an active preorder window
 */
export function canPlaceAs(item: MenuItem, orderType: 'spot' | 'preorder'): { ok: boolean; reason?: string } {
  if (orderType === 'spot') {
    if (item.order_type === 'preorder') {
      return { ok: false, reason: `${item.title} is a pre-order only item` }
    }
    return { ok: true }
  }

  // orderType === 'preorder'
  if (item.order_type === 'spot') {
    return { ok: false, reason: `${item.title} is a spot-order only item` }
  }

  // item supports preorder (preorder | both) — check window
  const win = activeWindow(item.preorder_windows ?? [])
  if (!win) {
    const next = nextWindow(item.preorder_windows ?? [])
    const label = next ? `opens at ${fmtTime(next.order_open)}` : 'no more windows today'
    return { ok: false, reason: `${item.title}: pre-order window closed (${label})` }
  }

  return { ok: true }
}

/** Can this item be added to cart as a spot order right now? */
export function canOrderAsSpot(item: MenuItem): boolean {
  return item.order_type === 'spot' || item.order_type === 'both'
}

/** Can this item be added to cart as a pre-order right now (i.e. inside an active window)? */
export function canOrderAsPreorder(item: MenuItem): boolean {
  if (item.order_type === 'spot') return false
  return activeWindow(item.preorder_windows ?? []) !== null
}

/**
 * Label shown under a closed preorder item on the store page.
 * Only relevant for pure 'preorder' items (both items are always addable for spot).
 */
export function nextWindowLabel(item: MenuItem): string | null {
  if (item.order_type === 'spot') return null
  if (item.order_type === 'both') return null  // always addable for spot
  // pure preorder
  const next = nextWindow(item.preorder_windows ?? [])
  if (!next) return 'No more windows today'
  return `Opens at ${fmtTime(next.order_open)}`
}
