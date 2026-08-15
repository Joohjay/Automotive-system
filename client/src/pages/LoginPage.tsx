import { useState, type FormEvent } from 'react'
import { CircleCheck, Eye, EyeOff, Loader2, Wrench } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

export function LoginPage() {
  const { login, settings } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const businessName = settings?.businessName ?? 'BennyBlax Enterprises'

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-linear-to-br from-zinc-500 via-zinc-800 to-zinc-950 p-8 text-zinc-100 md:flex">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 flex size-10 items-center justify-center rounded-lg">
              <Wrench className="size-5" />
            </div>
            <span className="text-lg font-semibold">{businessName}</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Auto Parts &amp; Accessories</h2>
            <p className="mt-2 text-sm text-zinc-300">
              POS, inventory, suppliers and credit management — all in one place.
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-zinc-300">
            {['Real-time stock control', 'Credit customer accounts', 'Purchase &amp; receiving'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <CircleCheck className="size-4" /> {item}
                </li>
              ),
            )}
          </ul>
        </div>
        <div className="flex flex-col justify-center p-8">
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <div className="bg-primary flex size-10 items-center justify-center rounded-lg text-primary-foreground">
              <Wrench className="size-5" />
            </div>
            <span className="text-lg font-semibold">{businessName}</span>
          </div>
          <Card className="border-0 p-0 shadow-none">
            <CardHeader className="p-0">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>Enter your credentials to access the system.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@autoparts.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                {error ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}