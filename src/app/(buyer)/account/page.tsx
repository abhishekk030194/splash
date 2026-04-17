'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { User, LogOut, ChefHat } from 'lucide-react'
import Link from 'next/link'

export default function AccountPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setEmail(user.email || '')

    const { data: profile } = await supabase
      .from('users')
      .select('name, phone')
      .eq('auth_id', user.id)
      .single()

    if (profile) {
      setName(profile.name || '')
      setPhone(profile.phone || '')
    }
    setLoading(false)
  }

  async function saveProfile() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('users')
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq('auth_id', user.id)

    if (error) {
      toast.error('Failed to save profile')
    } else {
      toast.success('Profile updated')
    }
    setSaving(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      <div className="h-8 bg-gray-100 rounded animate-pulse w-1/3" />
      <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold">Account</h1>

      {/* Profile */}
      <div className="bg-white rounded-2xl border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <User className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">{name || 'Your Name'}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <Input
              className="mt-1"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Phone Number</Label>
            <Input
              className="mt-1"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              type="tel"
            />
          </div>
        </div>

        <Button
          className="w-full bg-orange-500 hover:bg-orange-600"
          onClick={saveProfile}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Seller link */}
      <div className="bg-white rounded-2xl border p-4">
        <p className="text-sm font-semibold mb-1">Are you a seller?</p>
        <p className="text-xs text-muted-foreground mb-3">Manage your kitchen and orders from the seller dashboard.</p>
        <Link href="/seller/listings">
          <Button variant="outline" className="w-full border-orange-300 text-orange-600 hover:bg-orange-50">
            <ChefHat className="w-4 h-4 mr-2" />
            Go to Seller Dashboard
          </Button>
        </Link>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl border p-4">
        <Button
          variant="ghost"
          className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
