import { MenuItem, PreorderWindow } from '@/types'

const IST = 'Asia/Kolkata'

/** Returns current IST time as "HH:MM" */
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

/**
 * Returns the active preorder window if the current IST time falls within it,
 * or null if we're outside all windows.
 */
export function activeWindow(windows: PreorderWindow[]): PreorderWindow | null {
  const now = nowIST()
  return windows.find(w => cmpTime(now, w.order_open) >= 0 && cmpTime(now, w.order_close) < 0) ?? null
}

/**
 * Returns the next upcoming window (soonest order_open after now),
 * or null if there are no future windows today.
 */
export function nextWindow(windows: PreorderWindow[]): PreorderWindow | null {
  const now = nowIST()
  const upcoming = windows
    .filter(w => cmpTime(w.order_open, now) > 0)
    .sort((a, b) => cmpTime(a.order_open, b.order_open))
  return upcoming[0] ?? null
}

/**
 * Can a buyer add this item to cart right now?
 * - spot / both → always yes
 * - preorder → only if inside an active preorder window
 */
export function isOrderable(item: MenuItem): boolean {
  if (item.order_type === 'spot' || item.order_type === 'both') return true
  return activeWindow(item.preorder_windows ?? []) !== null
}

/**
 * Human-readable label for when ordering opens next.
 * e.g. "Opens at 06:00 PM"
 */
export function nextWindowLabel(item: MenuItem): string | null {
  if (item.order_type !== 'preorder') return null
  const next = nextWindow(item.preorder_windows ?? [])
  if (!next) return 'No more windows today'
  // Format "HH:MM" → "h:MM AM/PM"
  const [h, m] = next.order_open.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m, 0, 0)
  return `Opens at ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`
}
