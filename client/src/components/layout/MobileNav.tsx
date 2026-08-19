import { LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { BrandHeader, NavContent } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'

export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function go(href: string) {
    onOpenChange(false)
    navigate(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="!top-0 !left-0 h-dvh w-80 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0 sm:max-w-sm"
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <DialogDescription className="sr-only">Main application menu</DialogDescription>
        <div className="flex h-dvh flex-col">
          <BrandHeader />
          <NavContent onNavigate={() => onOpenChange(false)} />
          <div className="flex flex-col gap-2 border-t px-4 py-4">
            <div className="flex items-center gap-3 px-1">
              <span className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground">
                {(user?.fullName ?? 'U')
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">{user?.fullName}</p>
                <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
              </div>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => go('/account')}>
                <User className="size-4" />
                My Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void logout()}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}