'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Store } from '@/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Search, Clock, ChevronRight, MapPin, Loader2, Building2, Navigation, Pencil, X } from 'lucide-react'
import { LocationAutocomplete } from '@/components/LocationAutocomplete'

// ── Haversine distance in km ─────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Nominatim reverse geocode ────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const a = data.address || {}
    return a.residential || a.neighbourhood || a.suburb || a.city_district || a.town || a.city || 'Your location'
  } catch {
    return 'Your location'
  }
}


// ── Store grouping ────────────────────────────────────────────────────────────
interface StoreWithDistance extends Store {
  _distKm: number | null
}

function groupStores(stores: Store[], buyerLat: number | null, buyerLng: number | null) {
  const inSociety: StoreWithDistance[] = []
  const nearby: StoreWithDistance[] = []
  const others: StoreWithDistance[] = []

  for (const s of stores) {
    const hasCoords = s.lat != null && s.lng != null && buyerLat != null && buyerLng != null
    const distKm = hasCoords ? haversineKm(buyerLat!, buyerLng!, s.lat!, s.lng!) : null

    const store: StoreWithDistance = { ...s, _distKm: distKm }

    if (hasCoords && s.delivery_scope === 'society_only') {
      // Society-only: only show if buyer is within 500 m
      if (distKm! <= 0.5) inSociety.push(store)
      // else: hide entirely — buyer is outside this society
    } else if (hasCoords && s.delivery_scope === 'radius' && s.delivery_radius_km != null) {
      if (distKm! <= s.delivery_radius_km) nearby.push(store)
      // else: outside delivery radius — hide
    } else if (!hasCoords) {
      // No location data on store → show in others
      others.push(store)
    }
  }

  // Sort nearby by distance
  nearby.sort((a, b) => (a._distKm ?? 999) - (b._distKm ?? 999))

  return { inSociety, nearby, others }
}

// ── Store card ────────────────────────────────────────────────────────────────
function StoreCard({ store }: { store: StoreWithDistance }) {
  return (
    <Link href={`/store/${store.id}`}>
      <div className="bg-white rounded-2xl border p-4 flex items-center gap-3 hover:border-emerald-200 transition-colors">
        <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {store.image_url
            ? <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
            : <span className="text-2xl">🍳</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{store.name}</p>
            <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">Open</Badge>
            {store.delivery_scope === 'society_only' && (
              <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700">🏘️ Society</Badge>
            )}
          </div>
          {store.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{store.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {(store as any).open_from && (store as any).open_until && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {(store as any).open_from?.slice(0, 5)} – {(store as any).open_until?.slice(0, 5)}
              </p>
            )}
            {store._distKm != null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {store._distKm < 1 ? `${Math.round(store._distKm * 1000)} m` : `${store._distKm.toFixed(1)} km`}
              </p>
            )}
            {store.society_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                {store.society_name}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  )
}

// ── Group section ─────────────────────────────────────────────────────────────
function StoreGroup({ title, subtitle, stores, accent }: {
  title: string; subtitle?: string; stores: StoreWithDistance[]; accent: string
}) {
  if (stores.length === 0) return null
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="font-semibold text-base">{title}</h2>
        <span className="text-xs text-muted-foreground">{stores.length} kitchen{stores.length !== 1 ? 's' : ''}</span>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>}
      <div className={`border-l-2 pl-3 space-y-3 ${accent}`}>
        {stores.map(s => <StoreCard key={s.id} store={s} />)}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [supabase] = useState(() => createClient())
  const [stores, setStores] = useState<Store[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Location state
  const [buyerLat, setBuyerLat] = useState<number | null>(null)
  const [buyerLng, setBuyerLng] = useState<number | null>(null)
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)

  // Manual location edit
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationInput, setLocationInput] = useState('')

  useEffect(() => {
    loadStores()
    detectLocation()
  }, [])

  async function loadStores() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setStores(data || [])
    setLoading(false)
  }

  async function detectLocation() {
    if (!navigator.geolocation) { setLocationLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setBuyerLat(lat)
        setBuyerLng(lng)
        const label = await reverseGeocode(lat, lng)
        setLocationLabel(label)
        setLocationLoading(false)
      },
      () => { setLocationLoading(false) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // ── Filter + group ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return stores
    const q = search.toLowerCase()
    return stores.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.society_name || '').toLowerCase().includes(q)
    )
  }, [stores, search])

  const { inSociety, nearby, others } = useMemo(
    () => groupStores(filtered, buyerLat, buyerLng),
    [filtered, buyerLat, buyerLng]
  )

  const hasLocation = buyerLat != null && buyerLng != null
  const anyGrouped  = inSociety.length > 0 || nearby.length > 0

  return (
    <div className="p-4 space-y-5 pb-24">

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80 mb-0.5">Good {greeting()},</p>
        <h1 className="text-xl font-bold mb-3">What are you craving?</h1>

        {/* Location row */}
        <div className="mb-3">
          {editingLocation ? (
            // ── Manual input mode with autocomplete ──
            <div className="flex items-center gap-2">
              <LocationAutocomplete
                heroStyle
                autoFocus
                value={locationInput}
                onChange={setLocationInput}
                onSelect={s => {
                  setBuyerLat(s.lat)
                  setBuyerLng(s.lng)
                  setLocationLabel(s.label)
                  setEditingLocation(false)
                  setLocationInput('')
                }}
                placeholder="Type society, area or city…"
                className="flex-1"
              />
              <button
                onClick={() => { setEditingLocation(false); setLocationInput('') }}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            // ── Display mode ──
            <div className="flex items-center gap-2">
              {locationLoading ? (
                <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs opacity-90">Detecting location…</span>
                </div>
              ) : locationLabel ? (
                <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs font-medium">{locationLabel}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                  <MapPin className="w-3 h-3 opacity-60" />
                  <span className="text-xs opacity-70">Location not set</span>
                </div>
              )}
              {!locationLoading && (
                <button
                  onClick={() => { setEditingLocation(true); setLocationInput(locationLabel || '') }}
                  className="flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  <span className="text-xs">Change</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 bg-white text-gray-900 border-0"
            placeholder="Search kitchens, dishes, societies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-14 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <span className="text-2xl">{search ? '🔍' : '🏘️'}</span>
          </div>
          <p className="font-semibold text-gray-800 text-base">
            {search ? `No results for "${search}"` : 'No kitchens in your area yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
            {search
              ? 'Try a different name or browse all kitchens'
              : "Nook hasn't launched in your society yet. Know a home cook nearby? Invite them to join."}
          </p>
        </div>
      )}

      {/* Grouped store listing */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-6">
          {hasLocation ? (
            <>
              <StoreGroup
                title="🏘️ In your society"
                subtitle={locationLabel ? `Kitchens inside ${locationLabel}` : undefined}
                stores={inSociety}
                accent="border-purple-300"
              />
              <StoreGroup
                title="📍 Nearby kitchens"
                subtitle="Delivering to your location"
                stores={nearby}
                accent="border-emerald-300"
              />
              {anyGrouped && others.length > 0 && (
                <div className="border-t pt-4">
                  <StoreGroup
                    title="Other kitchens"
                    subtitle="May not deliver to your area"
                    stores={others}
                    accent="border-gray-200"
                  />
                </div>
              )}
              {/* No kitchens available at this location */}
              {!anyGrouped && others.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-14 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                    <span className="text-2xl">🏘️</span>
                  </div>
                  <p className="font-semibold text-gray-800 text-base">No kitchens in your area yet</p>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
                    Nook hasn't launched in your society yet. Know a home cook nearby? Invite them to join.
                  </p>
                </div>
              )}
              {!anyGrouped && others.length > 0 && (
                <StoreGroup
                  title="All kitchens"
                  stores={others}
                  accent="border-gray-200"
                />
              )}
            </>
          ) : (
            // No location — flat list
            <div>
              <h2 className="font-semibold text-base mb-3">
                {search ? `Results for "${search}"` : 'All kitchens'}
              </h2>
              <div className="space-y-3">
                {filtered.map(s => <StoreCard key={s.id} store={{ ...s, _distKm: null }} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
