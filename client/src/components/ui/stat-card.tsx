import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  pulse = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  pulse?: boolean
}) {
  const toneClasses: Record<string, string> = {
    default: 'bg-zinc-500/10 text-zinc-600',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    danger: 'bg-red-500/10 text-red-600',
    info: 'bg-sky-500/10 text-sky-600',
  }
  return (
    <Card className={cn(pulse && 'ring-2 ring-red-500/40 animate-stock-warning')}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-lg',
            toneClasses[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className="truncate text-xl font-semibold">{value}</p>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}