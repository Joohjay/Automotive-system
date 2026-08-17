import { NavLink } from 'react-router-dom'
import { Wrench } from 'lucide-react'

import { primaryNav, upcomingModules } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

function NavSection({
  items,
}: {
  items: typeof primaryNav
}) {
  const { hasPermission } = useAuth()
  const visible = items.filter((item) => !item.permission || hasPermission(item.permission))

  return (
    <nav className="flex flex-col gap-1 px-2">
      {visible.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === '/'}
          title={item.description}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function UpcomingSection() {
  return (
    <nav className="flex flex-col gap-1 px-2">
      <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
        Coming soon
      </p>
      {upcomingModules.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          title={item.description}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/70 hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Wrench className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">AutoParts</p>
          <p className="text-xs text-muted-foreground">POS &amp; Inventory</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-4">
        <NavSection items={primaryNav} />
        <UpcomingSection />
      </div>

      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        Version 0.1.0
      </div>
    </aside>
  )
}
