'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, generateImagePath } from '@/lib/supabase/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Camera, Loader2, LogOut } from 'lucide-react'

export default function SellerOnboardingPage() {
  const [supabase] = useState(() => createClient())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('Kitchen name is required'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      // Upsert user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .upsert({
          auth_id: user.id,
          name: user.user_metadata?.full_name || user.email || 'Seller',
          phone: user.phone || null,
          role: 'seller',
        }, { onConflict: 'auth_id' })
        .select('id')
        .single()

      if (profileError || !profile) {
        toast.error('Failed to create profile')
        return
      }

      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'store-images', generateImagePath('stores', imageFile.name))
      }

      const { error } = await supabase.from('stores').insert({
        owner_id: profile.id,
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl,
        is_active: true,
      })

      if (error) { toast.error('Failed to create store: ' + error.message); return }
      toast.success('Kitchen created!')
      window.location.href = '/seller/listings'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🍳</div>
          <CardTitle>Set up your kitchen</CardTitle>
          <CardDescription>Tell customers about your home kitchen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            <label htmlFor="store-img" className="cursor-pointer">
              <div className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${imagePreview ? 'border-emerald-300' : 'border-gray-300 hover:border-emerald-500'}`}>
                {imagePreview
                  ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  : <div className="text-center text-muted-foreground"><Camera className="w-6 h-6 mx-auto mb-1" /><span className="text-xs">Add photo</span></div>
                }
              </div>
            </label>
            <input id="store-img" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            <p className="text-xs text-muted-foreground">Kitchen photo (optional)</p>
          </div>

          <div className="space-y-1">
            <Label>Kitchen Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Anita's Kitchen" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>About your kitchen</Label>
            <Textarea placeholder="What do you cook? Any specialty?" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={handleSubmit} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create My Kitchen →'}
          </Button>

          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
            className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
