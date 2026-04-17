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
import { Camera, Loader2 } from 'lucide-react'

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

      // Get or create user profile
      let { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!profile) {
        const { data: newProfile, error } = await supabase
          .from('users')
          .insert({ auth_id: user.id, name: 'Seller', phone: user.phone ?? '', role: 'seller' })
          .select('id')
          .single()
        if (error) { toast.error('Failed to create profile'); return }
        profile = newProfile
      }

      // Upload image if provided
      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'store-images', generateImagePath('stores', imageFile.name))
        if (!imageUrl) { toast.error('Image upload failed — store will be created without image'); }
      }

      // Create store
      const { error } = await supabase.from('stores').insert({
        owner_id: profile.id,
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl,
        is_active: true,
      })

      if (error) { toast.error('Failed to create store'); return }

      toast.success('Kitchen created! Setting up your menu…')
      window.location.href = '/seller/listings'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🍳</div>
          <CardTitle>Set up your kitchen</CardTitle>
          <CardDescription>Tell customers about your home kitchen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Store image */}
          <div className="flex flex-col items-center gap-2">
            <label htmlFor="store-img" className="cursor-pointer">
              <div className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${imagePreview ? 'border-orange-300' : 'border-gray-300 hover:border-orange-400'}`}>
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
            <Input
              placeholder="e.g. Anita's Kitchen, Sharma Home Foods"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>About your kitchen</Label>
            <Textarea
              placeholder="What do you cook? Any specialty? e.g. Authentic Rajasthani home food, made fresh every morning"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full bg-orange-500 hover:bg-orange-600"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create My Kitchen →'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
