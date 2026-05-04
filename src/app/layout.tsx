import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import SentryUserContext from '@/components/SentryUserContext'
import PushNotificationSetup from '@/components/PushNotificationSetup'
import EnsureProfile from '@/components/EnsureProfile'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Nook — Food from your society',
  description: 'Food from your nook — homemade meals from kitchens in your society',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nook',
  },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-stone-50">
        <SentryUserContext />
        <EnsureProfile />
        <PushNotificationSetup />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
