const COLORS = {
  spot:     { border: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' }, // blue
  preorder: { border: '#ec4899', bg: '#fdf2f8', text: '#be185d' }, // pink
  both:     { border: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' }, // blue (fallback)
}

export function orderColor(orderType: string) {
  return COLORS[orderType as keyof typeof COLORS] ?? COLORS.spot
}

/** Short human-readable order reference, e.g. "#A3F2B1C0" */
export function orderRef(orderId: string) {
  return '#' + orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
}
