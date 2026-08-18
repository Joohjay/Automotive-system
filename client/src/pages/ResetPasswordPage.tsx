import { useState, type FormEvent } from 'react'
import { CheckCircle, Loader2, Wrench } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORD_HINT, validatePassword } from '@/lib/password'
import { resetPassword } from '@/services/password.service'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Invalid or missing reset token.')
      return
    }
    const pwError = validatePassword(newPassword)
    if (pwError) {
      setError(pwError)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setIsSubmitting(true)
    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. The link may have expired.')
    } finally {
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
          <span className="text-lg font-semibold">AutoParts</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Reset password</CardTitle>
            <CardDescription>Enter your new password below.</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 text-center">
                <CheckCircle className="mx-auto size-10 text-emerald-600" />
                <p className="text-sm">Your password has been reset successfully.</p>
                <Link to="/login" className="text-primary hover:underline text-sm font-medium">
                  Sign in with your new password
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPw">New Password</Label>
                  <Input
                    id="newPw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">{PASSWORD_HINT}</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPw">Confirm Password</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {error ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  {isSubmitting ? 'Resetting…' : 'Reset password'}
                </Button>
                <div className="text-center text-sm">
                  <Link to="/login" className="text-primary hover:underline">
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
