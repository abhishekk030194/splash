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
import { Camera, Clock, Store as StoreIcon, LogOut, Loader2 } from 'lucide-react'

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Stats (placeholder until Phase 2)
  const [stats] = useState({ totalOrders: 0, totalRevenue: 0, avgRating: 0, totalReviews: 0 })

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
    setImagePreview(s.image_url)
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
      <Card className="border-2 border-orange-100">
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

      {/* Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Orders', value: stats.totalOrders },
              { label: 'Total Revenue', value: `₹${stats.totalRevenue}` },
              { label: 'Avg Rating', value: stats.avgRating ? `${stats.avgRating} ⭐` : '—' },
              { label: 'Reviews', value: stats.totalReviews },
            ].map(s => (
              <div key={s.label} className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-orange-600">{s.value || '0'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-3">Full stats available in Phase 2</p>
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
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-orange-200 overflow-hidden flex items-center justify-center bg-orange-50 hover:border-orange-400 transition-colors">
                {imagePreview
                  ? <img src={imagePreview} alt="store" className="w-full h-full object-cover" />
                  : <Camera className="w-6 h-6 text-orange-300" />
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

          <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={saveSettings} disabled={saving}>
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
