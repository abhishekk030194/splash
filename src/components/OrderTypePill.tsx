import { Zap, CalendarClock } from 'lucide-react'

export function OrderTypePill({ type }: { type: string }) {
  if (type === 'spot') {
    return (
      <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
        <Zap className="w-3 h-3 fill-white" />
        Spot Order
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 bg-pink-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
      <CalendarClock className="w-3 h-3" />
      Pre-Order
    </span>
  )
}
