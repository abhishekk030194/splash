'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

export interface LocationSuggestion {
  label: string        // short name shown in the pill / stored as society_name
  displayName: string  // full address for the dropdown row
  lat: number
  lng: number
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (s: LocationSuggestion) => void
  placeholder?: string
  /** Extra classes for the outer wrapper div */
  className?: string
  /** Extra classes applied to the <input> element */
  inputClassName?: string
  /** If true, renders a borderless white-text input for use inside a colored hero */
  heroStyle?: boolean
  autoFocus?: boolean
}

async function fetchSuggestions(query: string): Promise<LocationSuggestion[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&countrycodes=in`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data: any[] = await res.json()
  return data.map(r => {
    const a = r.address || {}
    const label =
      a.residential || a.neighbourhood || a.suburb ||
      a.city_district || a.town || a.city ||
      r.display_name.split(',')[0]
    return {
      label,
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }
  })
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Type a location…',
  className = '',
  inputClassName = '',
  heroStyle = false,
  autoFocus = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const results = await fetchSuggestions(q)
      setSuggestions(results)
      setOpen(results.length > 0)
      setActiveIdx(-1)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    onChange(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 380)
  }

  function handleSelect(s: LocationSuggestion) {
    onChange(s.label)
    onSelect(s)
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const base = heroStyle
    ? `w-full bg-white/20 text-white placeholder-white/50 text-xs rounded-full pl-8 pr-3 py-1.5 outline-none border border-white/30 focus:border-white/60 ${inputClassName}`
    : `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClassName}`

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Pin icon inside input */}
      <div className="relative">
        {heroStyle && (
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-300 pointer-events-none" />
        )}
        {!heroStyle && (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        )}
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={heroStyle ? base : `${base} pl-9`}
        />
        {loading && (
          <Loader2 className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin ${heroStyle ? 'text-white/60' : 'text-muted-foreground'}`} />
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                i === activeIdx ? 'bg-emerald-50' : 'hover:bg-gray-50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.label}</p>
                <p className="text-xs text-muted-foreground truncate">{s.displayName}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
