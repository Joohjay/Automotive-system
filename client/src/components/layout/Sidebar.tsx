import { NavLink } from 'react-router-dom'
import { Wrench } from 'lucide-react'

import { navSections, type NavItem, type NavSection } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

function NavLinkItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      key={item.href}
      to={item.href}
      end={item.href === '/'}
      title={item.description}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]',
          isActive
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <item.icon className="size-4 shrink-0" />
      {item.label}
    </NavLink>
  )
}

function NavSectionList({ section, onNavigate }: { section: NavSection; onNavigate?: () => void }) {
  const { hasPermission } = useAuth()
  const visible = section.items.filter(
    (item) => !item.permission || hasPermission(item.permission),
  )
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
        {section.label}
      </p>
      {visible.map((item) => (
        <NavLinkItem key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

/** Shared navigation body used by the desktop sidebar and the mobile drawer. */
export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label="Main">
      {navSections.map((section) => (
        <NavSectionList key={section.label} section={section} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  const { settings } = useAuth()
  return (
    <div className={cn('flex items-center gap-2 border-b px-4', compact ? 'h-14' : 'h-14')}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Wrench className="size-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">{settings?.businessName ?? 'BennyBlax Enterprises'}</p>
        <p className="text-muted-foreground truncate text-xs">Spare Parts POS &amp; Inventory</p>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <BrandHeader />
      <NavContent />
    </aside>
  )
}