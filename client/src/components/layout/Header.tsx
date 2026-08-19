import { useState } from 'react'
import { Circle, CircleCheck, CircleX, LogOut, Menu, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { MobileNav } from '@/components/layout/MobileNav'
import { primaryNav } from '@/config/navigation'
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
import { NotificationBell } from '@/components/NotificationBell'

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
  const navigate = useNavigate()
  const initials = (user?.fullName ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2" aria-label="Account menu">
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
        <DropdownMenuItem onSelect={() => navigate('/account')}>
          <User /> My Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void logout()} variant="destructive">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header() {
  const { settings } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const currentPage = primaryNav.find((item) => {
    if (item.href === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.href)
  })?.label

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
        <h1 className="truncate text-sm font-semibold md:hidden">
          {settings?.businessName ?? 'BennyBlax Enterprises'}
        </h1>
        <p className="hidden text-sm font-semibold text-foreground md:block">
          {currentPage ?? settings?.businessName ?? 'BennyBlax Enterprises'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ConnectionBadge />
        <NotificationBell />
        <UserMenu />
      </div>
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </header>
  )
}