import { useState, type FormEvent } from 'react'
import { Loader2, ShieldCheck, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mfaVerify } from '@/services/mfa'

export function MfaVerifyPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim() || code.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.')
      return
    }
    setIsSubmitting(true)
    try {
      await mfaVerify(code.trim())
      // After MFA verification, the server sets the real auth cookie.
      // Redirect to home — ProtectedRoute will call fetchMe() on next load.
      navigate('/', { replace: true })
      // Force a full reload so AuthProvider re-fetches /me with the new cookie
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="bg-primary flex size-10 items-center justify-center rounded-lg text-primary-foreground">
            <Wrench className="size-5" />
          </div>
          <span className="text-lg font-semibold">BennyBlax Enterprises</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="size-6" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="mfa-code">Authentication Code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>
              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {isSubmitting ? 'Verifying…' : 'Verify'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
