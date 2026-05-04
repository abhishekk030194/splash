'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EnsureProfile() {
  useEffect(() => {
    async function ensure() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single()

      if (profile) return

      await fetch('/api/auth/ensure-profile', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.access_token}` },
      })
    }
    ensure()
  }, [])

  return null
}
