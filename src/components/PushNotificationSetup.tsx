'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PushNotificationSetup() {
  useEffect(() => {
    setup()
  }, [])

  async function setup() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'denied') return

    try {
      await navigator.serviceWorker.register('/sw.js')
      const reg = await navigator.serviceWorker.ready

      // Already subscribed? Re-register to keep subscription fresh
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await saveSubscription(existing)
        return
      }

      // Ask permission only if not yet granted
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      await saveSubscription(sub)
    } catch {
      // Silently fail — push is non-critical
    }
  }

  async function saveSubscription(sub: PushSubscription) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch('/api/push/subscribe', {
      method:  'POST',
      headers: {
        'content-type':  'application/json',
        authorization:   `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })
  }

  return null
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
