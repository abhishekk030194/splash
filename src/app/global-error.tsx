'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
          <p className="text-lg font-semibold text-gray-800">Something went wrong</p>
          <p className="text-sm text-gray-500">The error has been reported. Please try again.</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
