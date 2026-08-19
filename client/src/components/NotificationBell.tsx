import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, PackageX, PackageSearch, AlertTriangle, CreditCard, CircleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/notification.service'
import type { Notification, NotificationType } from '@/types/notification'

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  OUT_OF_STOCK: PackageX,
  LOW_STOCK: PackageSearch,
  LOAN_REMINDER: AlertTriangle,
  LOAN_OVERDUE: AlertTriangle,
  CREDIT_WARNING: CreditCard,
  OTHER: CircleAlert,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  OUT_OF_STOCK: 'text-red-600',
  LOW_STOCK: 'text-amber-600',
  LOAN_REMINDER: 'text-sky-600',
  LOAN_OVERDUE: 'text-red-600',
  CREDIT_WARNING: 'text-amber-600',
  OTHER: 'text-zinc-500',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await listNotifications({ status: 'UNREAD', pageSize: 20 })
      setUnreadCount(res.unreadCount)
      setNotifications(res.data)
    } catch {
      // Silent: bell just stays at 0
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 60_000)
    return () => clearInterval(t)
  }, [refresh])

  async function handleOpen() {
    setLoading(true)
    try {
      const res = await listNotifications({ pageSize: 20 })
      setNotifications(res.data)
      setUnreadCount(res.unreadCount)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'READ' as const } : n)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'READ' as const })))
    setUnreadCount(0)
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) void handleOpen() }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 px-2 py-1 text-xs"
              onClick={() => void handleMarkAllRead()}
            >
              <CheckCheck className="size-3" />
              Mark all read
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          notifications.map((n) => {
            const Icon = TYPE_ICON[n.type]
            const color = TYPE_COLOR[n.type]
            const isUnread = n.status === 'UNREAD'
            return (
              <DropdownMenuItem
                key={n.id}
                className={`flex items-start gap-3 py-3 ${isUnread ? 'bg-muted/50' : ''}`}
                onSelect={(e) => {
                  e.preventDefault()
                  if (isUnread) void handleMarkRead(n.id)
                }}
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-tight ${isUnread ? 'font-semibold' : 'font-medium'}`}>
                    {n.title}
                  </p>
                  {n.message ? (
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {n.message}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
                {isUnread ? (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-red-600" />
                ) : null}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
