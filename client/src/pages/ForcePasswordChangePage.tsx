import { useState, type FormEvent } from 'react'
import { Loader2, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { PASSWORD_HINT, validatePassword } from '@/lib/password'
import { changePassword } from '@/services/password.service'

export function ForcePasswordChangePage() {
  const { logout, clearMustChangePassword } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!currentPassword || !newPassword) {
      setError('Please fill in all fields.')
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
      await changePassword(currentPassword, newPassword)
      clearMustChangePassword()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.')
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
          <span className="text-lg font-semibold">BennyBlax Enterprises</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Change your password</CardTitle>
            <CardDescription>
              Your password was reset by an administrator. Please set a new password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPw">Current Password</Label>
                <Input
                  id="currentPw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter the password you just used to sign in"
                />
              </div>
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
                {isSubmitting ? 'Saving…' : 'Change Password & Continue'}
              </Button>
              <div className="text-center text-sm">
                <button type="button" onClick={() => void logout()} className="text-muted-foreground hover:underline">
                  Sign in with a different account
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
