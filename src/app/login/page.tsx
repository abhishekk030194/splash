'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [supabase] = useState(() => createClient())

  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      toast.error('Enter a valid 10-digit phone number')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('OTP sent!')
      setStep('otp')
    }
  }

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Enter the 6-digit OTP')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🍱</div>
          <CardTitle className="text-2xl font-bold text-orange-600">Splash</CardTitle>
          <CardDescription>Home kitchens, delivered fresh</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'phone' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 bg-muted border rounded-md text-sm text-muted-foreground">+91</span>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="98765 43210"
                    maxLength={10}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && sendOTP()}
                  />
                </div>
              </div>
              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={sendOTP} disabled={loading}>
                {loading ? 'Sending…' : 'Send OTP'}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP sent to +91 {phone}</Label>
                <Input
                  id="otp"
                  type="tel"
                  placeholder="6-digit OTP"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                />
              </div>
              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={verifyOTP} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & Login'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('phone')}>
                ← Change number
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
