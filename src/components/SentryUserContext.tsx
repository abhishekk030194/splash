'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/client'

export default function SentryUserContext() {
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: profile } = await supabase
        .from('users')
        .select('name, phone, role')
        .eq('auth_id', session.user.id)
        .single()
      if (profile) {
        Sentry.setUser({
          id:    session.user.id,
          username: profile.name,
          phone: profile.phone,
          role:  profile.role,
        })
      }
    })
  }, [])

  return null
}
