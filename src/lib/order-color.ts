/**
 * Derives a consistent color from an order ID.
 * Same order ID always maps to the same color on both buyer and seller views.
 */

const PALETTE = [
  { border: 'border-l-rose-400',   bg: 'bg-rose-50',   text: 'text-rose-700',   dot: 'bg-rose-400'   },
  { border: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  { border: 'border-l-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  { border: 'border-l-lime-500',   bg: 'bg-lime-50',   text: 'text-lime-700',   dot: 'bg-lime-500'   },
  { border: 'border-l-teal-400',   bg: 'bg-teal-50',   text: 'text-teal-700',   dot: 'bg-teal-400'   },
  { border: 'border-l-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  { border: 'border-l-violet-400', bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' },
  { border: 'border-l-pink-400',   bg: 'bg-pink-50',   text: 'text-pink-700',   dot: 'bg-pink-400'   },
]

export function orderColor(orderId: string) {
  // Use first 2 hex chars of UUID as an 8-bit number, mod palette length
  const n = parseInt(orderId.replace(/-/g, '').slice(0, 2), 16)
  return PALETTE[n % PALETTE.length]
}

/** Short human-readable order reference, e.g. "#A3F2B1C0" */
export function orderRef(orderId: string) {
  return '#' + orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
}
