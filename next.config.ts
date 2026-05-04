import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest:              'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline:    true,
  disable:           process.env.NODE_ENV === 'development',
  // Use our custom service worker (handles push notifications)
  customWorkerSrc:   'sw.js',
  workboxOptions: {
    disableDevLogs: true,
  },
})

const nextConfig: NextConfig = {}

export default withSentryConfig(withPWA(nextConfig), {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent:  true,
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
})
