import { useEffect, useState } from 'react'
import { Loader2, LogOut, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { useAuth } from '@/contexts/AuthContext'
import { PASSWORD_HINT, validatePassword } from '@/lib/password'
import { changePassword } from '@/services/password.service'
import { mfaStatus, mfaSetup, mfaEnable, mfaDisable } from '@/services/mfa'

export function AccountPage() {
  const { user, logout } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'verify-enable' | 'verify-disable'>('idle')
  const [mfaUri, setMfaUri] = useState<string | null>(null)
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaPassword, setMfaPassword] = useState('')
  const [mfaProcessing, setMfaProcessing] = useState(false)

  useEffect(() => {
    mfaStatus()
      .then((res) => setMfaEnabled(res.mfaEnabled))
      .catch(() => {})
      .finally(() => setMfaLoading(false))
  }, [])

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all password fields')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    const pwError = validatePassword(newPassword)
    if (pwError) {
      toast.error(pwError)
      return
    }
    setSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  async function handleMfaSetup() {
    if (!mfaPassword) {
      toast.error('Enter your password to continue')
      return
    }
    setMfaProcessing(true)
    try {
      const res = await mfaSetup(mfaPassword)
      setMfaUri(res.uri)
      setMfaSecret(res.secret)
      setMfaStep('verify-enable')
      setMfaPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start MFA setup')
    } finally {
      setMfaProcessing(false)
    }
  }

  async function handleMfaEnable() {
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setMfaProcessing(true)
    try {
      await mfaEnable(mfaCode)
      setMfaEnabled(true)
      setMfaStep('idle')
      setMfaUri(null)
      setMfaSecret(null)
      setMfaCode('')
      toast.success('Two-factor authentication has been enabled')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setMfaProcessing(false)
    }
  }

  async function handleMfaDisable() {
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error('Enter the 6-digit code to disable MFA')
      return
    }
    setMfaProcessing(true)
    try {
      await mfaDisable(mfaCode)
      setMfaEnabled(false)
      setMfaStep('idle')
      setMfaCode('')
      toast.success('Two-factor authentication has been disabled')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setMfaProcessing(false)
    }
  }

  function cancelMfa() {
    setMfaStep('idle')
    setMfaUri(null)
    setMfaSecret(null)
    setMfaCode('')
    setMfaPassword('')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Account" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Name</span>
              <p className="font-medium">{user?.fullName ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{user?.email ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Role</span>
              <p className="font-medium">{user?.roleName ?? '—'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="currentPw">Current Password</Label>
              <Input
                id="currentPw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
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
              <Label htmlFor="confirmPw">Confirm New Password</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button onClick={() => void handleChangePassword()} disabled={saving}>
              {saving ? 'Saving…' : 'Change Password'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* MFA Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account with an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mfaLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : mfaStep === 'idle' ? (
            mfaEnabled ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">MFA is enabled</p>
                  <p className="text-muted-foreground text-xs">
                    Your account is protected with two-factor authentication.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setMfaStep('verify-disable')}
                >
                  <ShieldOff className="mr-1 size-4" />
                  Disable
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">MFA is not enabled</p>
                  <p className="text-muted-foreground text-xs">
                    Protect your account by requiring a code from your phone at login.
                  </p>
                </div>
                <Button size="sm" onClick={() => setMfaStep('setup')}>
                  <ShieldCheck className="mr-1 size-4" />
                  Enable
                </Button>
              </div>
            )
          ) : mfaStep === 'setup' ? (
            <div className="space-y-4">
              <p className="text-sm">Enter your current password to start MFA setup.</p>
              <div className="grid gap-2">
                <Label htmlFor="mfa-pw">Password</Label>
                <Input
                  id="mfa-pw"
                  type="password"
                  value={mfaPassword}
                  onChange={(e) => setMfaPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void handleMfaSetup()} disabled={mfaProcessing}>
                  {mfaProcessing ? <Loader2 className="animate-spin" /> : null}
                  Continue
                </Button>
                <Button variant="ghost" onClick={cancelMfa}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : mfaStep === 'verify-enable' ? (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 text-sm font-medium text-amber-800">
                  Scan this QR code with your authenticator app
                </p>
                {mfaUri && (
                  <div className="mb-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaUri)}`}
                      alt="MFA QR Code"
                      className="rounded border bg-white p-1"
                      width={200}
                      height={200}
                    />
                  </div>
                )}
                {mfaSecret && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">
                      Or enter this secret manually:
                    </p>
                    <code className="bg-muted block rounded p-2 text-sm font-mono break-all">
                      {mfaSecret}
                    </code>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mfa-verify-code">Enter the 6-digit code</Label>
                <Input
                  id="mfa-verify-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void handleMfaEnable()} disabled={mfaProcessing}>
                  {mfaProcessing ? <Loader2 className="animate-spin" /> : null}
                  Enable MFA
                </Button>
                <Button variant="ghost" onClick={cancelMfa}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* verify-disable */
            <div className="space-y-4">
              <p className="text-sm">
                Enter the 6-digit code from your authenticator app to disable MFA.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="mfa-disable-code">Authentication Code</Label>
                <Input
                  id="mfa-disable-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => void handleMfaDisable()}
                  disabled={mfaProcessing}
                >
                  {mfaProcessing ? <Loader2 className="animate-spin" /> : null}
                  Disable MFA
                </Button>
                <Button variant="ghost" onClick={cancelMfa}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" onClick={() => void logout()}>
            <LogOut className="size-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
