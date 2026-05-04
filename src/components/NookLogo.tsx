export function NookLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const icon  = { sm: 'w-5 h-5',  md: 'w-6 h-6',   lg: 'w-10 h-10' }[size]
  const nk    = { sm: 'text-base', md: 'text-lg',    lg: 'text-3xl'  }[size]
  const oo    = { sm: 'text-lg',   md: 'text-xl',    lg: 'text-4xl'  }[size]
  const gap   = { sm: 'gap-1.5',   md: 'gap-2',      lg: 'gap-3'     }[size]
  const sw    = { sm: 1.8,         md: 2,             lg: 2.5         }[size]

  return (
    <div className={`flex items-center ${gap}`}>
      {/* Icon — solid circle + outline circle = the "oo" */}
      <svg className={`${icon} flex-shrink-0`} viewBox="0 0 24 24" fill="none">
        <circle cx="8"  cy="12" r="5.5" fill="#047857" />
        <circle cx="16" cy="12" r="5.5" stroke="#047857" strokeWidth={sw} />
      </svg>

      {/* Wordmark — n/k lighter, oo is the anchor */}
      <span className="font-semibold tracking-tight leading-none text-stone-700">
        <span className={nk}>n</span>
        <span className={`${oo} font-bold text-emerald-700`}>o</span>
        <span className={`${oo} font-bold text-emerald-700 opacity-40`}>o</span>
        <span className={nk}>k</span>
      </span>
    </div>
  )
}
