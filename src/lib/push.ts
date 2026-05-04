// Server-side helper to send push notifications
export async function sendPush(userId: string, title: string, body: string, url = '/') {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await fetch(`${base}/api/push/send`, {
      method:  'POST',
      headers: {
        'content-type':      'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ user_id: userId, title, body, url }),
    })
  } catch {
    // Non-critical — don't fail the main request if push fails
  }
}
