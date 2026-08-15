import { Circle, CircleCheck, CircleX, LogOut, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApiHealth } from '@/hooks/useApiHealth'
import { useAuth } from '@/contexts/AuthContext'

function ConnectionBadge() {
  const health = useApiHealth()

  if (health.status === 'loading') {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <Circle className="size-3" /> Connecting…
      </span>
    )
  }

  if (health.status === 'error') {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-destructive sm:flex">
        <CircleX className="size-3" /> API offline
      </span>
    )
  }

  return (
    <span className="hidden items-center gap-1.5 text-xs text-emerald-600 sm:flex">
      <CircleCheck className="size-3" /> Connected
      {health.data.database === 'down' && <span className="text-destructive">· DB down</span>}
    </span>
  )
}

function UserMenu() {
  const { user, logout, settings } = useAuth()
  const initials = (user?.fullName ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <span className="bg-primary flex size-7 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden flex-col items-start leading-tight md:flex">
            <span className="text-xs font-medium">{user?.fullName}</span>
            <span className="text-muted-foreground text-[11px]">{settings?.businessName}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <User className="size-4" />
          <div className="flex flex-col">
            <span>{user?.fullName}</span>
            <span className="text-muted-foreground font-normal">{user?.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()} variant="destructive">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header() {
  const { settings } = useAuth()
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold md:hidden">
          {settings?.businessName ?? 'AutoParts'}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <ConnectionBadge />
        <UserMenu />
      </div>
    </header>
  )
}