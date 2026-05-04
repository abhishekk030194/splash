'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, generateImagePath } from '@/lib/supabase/storage'
import { Store } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Camera, Clock, Store as StoreIcon, LogOut, Loader2, MapPin, Navigation } from 'lucide-react'
import { LocationAutocomplete } from '@/components/LocationAutocomplete'

export default function SellerAccountPage() {
  const [supabase] = useState(() => createClient())
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable store fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [openFrom, setOpenFrom] = useState('')
  const [openUntil, setOpenUntil] = useState('')
  const [defaultEta, setDefaultEta] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Location & delivery
  const [societyName, setSocietyName] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [deliveryScope, setDeliveryScope] = useState<'society_only' | 'radius'>('radius')
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number | null>(null)
  const [pinningLocation, setPinningLocation] = useState(false)

  // Fulfillment
  const [offersPickup, setOffersPickup] = useState(false)
  const [offersDelivery, setOffersDelivery] = useState(true)
  const [deliveryFeeSpot, setDeliveryFeeSpot] = useState('')
  const [deliveryFeePreorder, setDeliveryFeePreorder] = useState('')

  // Payment methods
  const [acceptsCod, setAcceptsCod] = useState(false)
  const [acceptsOnlineOnDelivery, setAcceptsOnlineOnDelivery] = useState(false)


  useEffect(() => { loadStore() }, [])

  async function loadStore() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
    if (!profile) { window.location.href = '/seller/onboarding'; return }

    const { data: s } = await supabase.from('stores').select('*').eq('owner_id', profile.id).single()
    if (!s) { window.location.href = '/seller/onboarding'; return }

    setStore(s)
    setName(s.name)
    setDescription(s.description || '')
    setIsActive(s.is_active)
    setOpenFrom((s as any).open_from || '')
    setOpenUntil((s as any).open_until || '')
    setDefaultEta((s as any).default_eta_minutes?.toString() || '')
    setImagePreview(s.image_url)
    setSocietyName((s as any).society_name || '')
    setLat((s as any).lat ?? null)
    setLng((s as any).lng ?? null)
    setDeliveryScope((s as any).delivery_scope || 'radius')
    setDeliveryRadiusKm((s as any).delivery_radius_km ?? null)
    setOffersPickup((s as any).offers_pickup ?? false)
    setOffersDelivery((s as any).offers_delivery ?? true)
    setDeliveryFeeSpot((s as any).delivery_fee_spot?.toString() ?? '0')
    setDeliveryFeePreorder((s as any).delivery_fee_preorder?.toString() ?? '0')
    setAcceptsCod((s as any).accepts_cod ?? false)
    setAcceptsOnlineOnDelivery((s as any).accepts_online_on_delivery ?? false)
    setLoading(false)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function saveSettings() {
    if (!name.trim()) { toast.error('Kitchen name cannot be empty'); return }
    if (!offersPickup && !offersDelivery) { toast.error('Select at least one fulfillment option — pickup or delivery'); return }
    if (!store) return
    setSaving(true)

    let imageUrl = store.image_url
    if (imageFile) {
      const uploaded = await uploadImage(imageFile, 'store-images', generateImagePath('stores', imageFile.name))
      if (uploaded) imageUrl = uploaded
      else toast.error('Image upload failed — other changes will still be saved')
    }

    const { error } = await supabase.from('stores').update({
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
      image_url: imageUrl,
      open_from: openFrom || null,
      open_until: openUntil || null,
      default_eta_minutes: defaultEta ? parseInt(defaultEta) : null,
      society_name: societyName.trim() || null,
      lat,
      lng,
      delivery_scope: deliveryScope,
      delivery_radius_km: deliveryScope === 'radius' ? deliveryRadiusKm : null,
      offers_pickup: offersPickup,
      offers_delivery: offersDelivery,
      delivery_fee_spot:           parseFloat(deliveryFeeSpot)     || 0,
      delivery_fee_preorder:       parseFloat(deliveryFeePreorder) || 0,
      accepts_cod:                 acceptsCod,
      accepts_online_on_delivery:  acceptsOnlineOnDelivery,
    } as any).eq('id', store.id)

    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success('Settings saved')
    setStore(prev => prev ? { ...prev, name, description, is_active: isActive, image_url: imageUrl } : prev)
  }

  async function toggleActive(val: boolean) {
    if (!store) return
    setIsActive(val)
    await supabase.from('stores').update({ is_active: val }).eq('id', store.id)
    toast.success(val ? 'Kitchen is now open 🟢' : 'Kitchen is now closed 🔴')
  }

  async function pinLocation() {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setPinningLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setPinningLocation(false)
        toast.success('Location pinned')
      },
      () => { toast.error('Could not get location'); setPinningLocation(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4">

      {/* Kitchen Status — prominent card */}
      <Card className="border-2 border-emerald-100">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-base">{store?.name}</p>
              <Badge variant={isActive ? 'default' : 'secondary'} className={`mt-1 text-xs ${isActive ? 'bg-green-500' : ''}`}>
                {isActive ? '🟢 Open for orders' : '🔴 Closed'}
              </Badge>
            </div>
            <Switch checked={isActive} onCheckedChange={toggleActive} />
          </div>
        </CardContent>
      </Card>

      {/* Kitchen Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StoreIcon className="w-4 h-4" /> Kitchen Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Kitchen photo */}
          <div className="flex items-center gap-4">
            <label htmlFor="store-img-edit" className="cursor-pointer flex-shrink-0">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-emerald-200 overflow-hidden flex items-center justify-center bg-emerald-50 hover:border-emerald-500 transition-colors">
                {imagePreview
                  ? <img src={imagePreview} alt="store" className="w-full h-full object-cover" />
                  : <Camera className="w-6 h-6 text-emerald-300" />
                }
              </div>
            </label>
            <input id="store-img-edit" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            <div className="flex-1">
              <p className="text-sm font-medium">Kitchen Photo</p>
              <p className="text-xs text-muted-foreground">Tap to change. Shown to customers on your store page.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label>Kitchen Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Tell customers what you cook…" />
          </div>

          <Separator />

          {/* Store-level operating hours */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Operating Hours
            </Label>
            <p className="text-xs text-muted-foreground">Kitchen-wide hours. Orders outside this window will be blocked.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Opens at</Label>
                <Input type="time" value={openFrom} onChange={e => setOpenFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Closes at</Label>
                <Input type="time" value={openUntil} onChange={e => setOpenUntil(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave blank to accept orders anytime kitchen is open.</p>
          </div>

          <Separator />

          {/* Default ETA */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Default Delivery ETA
            </Label>
            <p className="text-xs text-muted-foreground">How many minutes after order placement should customers expect their spot order?</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="e.g. 30"
                className="w-28"
                value={defaultEta}
                onChange={e => setDefaultEta(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>

          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={saveSettings} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Fulfillment Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            🚚 Fulfillment Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Select how customers can receive their orders. At least one must be enabled.</p>

          <div
            onClick={() => setOffersDelivery(v => !v)}
            className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${offersDelivery ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🛵</span>
              <div>
                <p className="text-sm font-semibold">Delivery by kitchen</p>
                <p className="text-xs text-muted-foreground">You deliver to the customer's location</p>
              </div>
            </div>
            <Switch checked={offersDelivery} onCheckedChange={setOffersDelivery} onClick={e => e.stopPropagation()} />
          </div>

          <div
            onClick={() => setOffersPickup(v => !v)}
            className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${offersPickup ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🏃</span>
              <div>
                <p className="text-sm font-semibold">Self pickup</p>
                <p className="text-xs text-muted-foreground">Customer picks up from your kitchen</p>
              </div>
            </div>
            <Switch checked={offersPickup} onCheckedChange={setOffersPickup} onClick={e => e.stopPropagation()} />
          </div>

          {!offersPickup && !offersDelivery && (
            <p className="text-xs text-red-500 font-medium">⚠️ Enable at least one option to accept orders.</p>
          )}

          {offersDelivery && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  Delivery Fees
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">Set to 0 for free delivery.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Spot order fee (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="0"
                      value={deliveryFeeSpot}
                      onChange={e => setDeliveryFeeSpot(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Pre-order fee (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="0"
                      value={deliveryFeePreorder}
                      onChange={e => setDeliveryFeePreorder(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={saveSettings} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            💳 Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Pay Now (online via Razorpay) is always available. Enable additional options below.</p>

          {/* Pay Now — always on, non-toggleable */}
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">💳</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Pay Now (Online)</p>
                <p className="text-xs text-muted-foreground">Razorpay — card, UPI, net banking</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Always on</span>
          </div>

          <div
            onClick={() => setAcceptsCod(v => !v)}
            className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${acceptsCod ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💵</span>
              <div>
                <p className="text-sm font-semibold">Cash on Delivery</p>
                <p className="text-xs text-muted-foreground">Customer pays cash when order arrives</p>
              </div>
            </div>
            <Switch checked={acceptsCod} onCheckedChange={setAcceptsCod} onClick={e => e.stopPropagation()} />
          </div>

          <div
            onClick={() => setAcceptsOnlineOnDelivery(v => !v)}
            className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${acceptsOnlineOnDelivery ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📱</span>
              <div>
                <p className="text-sm font-semibold">Pay Online Before Delivery</p>
                <p className="text-xs text-muted-foreground">Customer pays via UPI/card before delivery</p>
              </div>
            </div>
            <Switch checked={acceptsOnlineOnDelivery} onCheckedChange={setAcceptsOnlineOnDelivery} onClick={e => e.stopPropagation()} />
          </div>

          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={saveSettings} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Location & Delivery */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" /> Location & Delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Pin location */}
          <div className="space-y-2">
            <Label>Kitchen Location</Label>
            <p className="text-xs text-muted-foreground">Used to show your kitchen to nearby buyers and match your society.</p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={pinLocation}
                disabled={pinningLocation}
                className="flex items-center gap-2"
              >
                {pinningLocation
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Navigation className="w-3.5 h-3.5" />
                }
                {lat && lng ? 'Update location' : 'Pin my location'}
              </Button>
              {lat && lng && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              )}
            </div>
          </div>

          {/* Society name */}
          <div className="space-y-1">
            <Label>Society / Apartment Name</Label>
            <LocationAutocomplete
              value={societyName}
              onChange={setSocietyName}
              onSelect={s => {
                setSocietyName(s.label)
                // Also pin coordinates if the seller hasn't already set them
                if (!lat || !lng) { setLat(s.lat); setLng(s.lng) }
              }}
              placeholder="e.g. Sobha Dream Acres, Prestige Shantiniketan…"
              inputClassName="border-input"
            />
            <p className="text-xs text-muted-foreground">Buyers in the same society will see your kitchen first.</p>
          </div>

          <Separator />

          {/* Delivery scope */}
          <div className="space-y-3">
            <Label>Who can order from you?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryScope('society_only')}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  deliveryScope === 'society_only'
                    ? 'border-emerald-700 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold">🏘️ My society only</p>
                <p className="text-xs text-muted-foreground mt-0.5">Only buyers in the same society</p>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryScope('radius')}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  deliveryScope === 'radius'
                    ? 'border-emerald-700 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold">📍 Delivery radius</p>
                <p className="text-xs text-muted-foreground mt-0.5">Anyone within a set distance</p>
              </button>
            </div>

            {deliveryScope === 'radius' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Delivery radius</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(km => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setDeliveryRadiusKm(km)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        deliveryRadiusKm === km
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={saveSettings} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card>
        <CardContent className="pt-4">
          <Button variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/5" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </CardContent>
      </Card>

    </div>
  )
}
