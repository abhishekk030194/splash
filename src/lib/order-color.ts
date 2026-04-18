/**
 * Derives a consistent color from an order ID using inline styles —
 * avoids Tailwind purge issues with dynamically constructed class names.
 * Same order ID always maps to the same color on buyer and seller views.
 */

const PALETTE = [
  { border: '#f43f5e', bg: '#fff1f2', text: '#be123c' }, // rose
  { border: '#f97316', bg: '#fff7ed', text: '#c2410c' }, // orange
  { border: '#f59e0b', bg: '#fffbeb', text: '#b45309' }, // amber
  { border: '#84cc16', bg: '#f7fee7', text: '#4d7c0f' }, // lime
  { border: '#14b8a6', bg: '#f0fdfa', text: '#0f766e' }, // teal
  { border: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' }, // blue
  { border: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9' }, // violet
  { border: '#ec4899', bg: '#fdf2f8', text: '#be185d' }, // pink
]

export function orderColor(orderId: string) {
  const n = parseInt(orderId.replace(/-/g, '').slice(0, 2), 16)
  return PALETTE[n % PALETTE.length]
}

/** Short human-readable order reference, e.g. "#A3F2B1C0" */
export function orderRef(orderId: string) {
  return '#' + orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
}
