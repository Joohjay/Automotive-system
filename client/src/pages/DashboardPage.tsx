import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, Package, PackageSearch, PackageX, Receipt, Wallet, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { useApiHealth } from '@/hooks/useApiHealth'
import { useAuth } from '@/contexts/AuthContext'
import { getInventorySummary } from '@/services/inventory.service'
import { OutOfStockAlert } from '@/components/OutOfStockAlert'
import type { InventorySummary } from '@/types/inventory'

const upcomingModules = [
  {
    title: 'Expenses',
    description: 'Operational costs and expense categories.',
    icon: Wallet,
    href: '/expenses',
  },
  {
    title: 'Loans',
    description: 'Funding sources, lending and loan repayment.',
    icon: ClipboardList,
    href: '/loans',
  },
  {
    title: 'Reports',
    description: 'Sales, stock and credit analytics.',
    icon: Receipt,
    href: '/reports',
  },
]

let oosAlertShownThisSession = false

export function DashboardPage() {
  const health = useApiHealth()
  const { user, settings } = useAuth()
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [oosAlertOpen, setOosAlertOpen] = useState(false)
  const alertTriggeredRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await getInventorySummary())
    } catch {
      // Silent: dashboard stays empty when API is unreachable.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (alertTriggeredRef.current) return
    if (summary && summary.outOfStockItems.length > 0 && !oosAlertShownThisSession) {
      alertTriggeredRef.current = true
      oosAlertShownThisSession = true
      setOosAlertOpen(true)
    }
  }, [summary])

  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {greeting}, {user?.fullName?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {settings?.businessName} — {settings?.currency} · {health.status === 'ok' ? 'online' : 'offline'}
          </p>
        </div>
        {health.status === 'ok' && (
          <Badge variant={health.data.database === 'up' ? 'success' : 'warning'}>
            {health.data.database === 'up' ? 'System online' : 'Database offline'}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/products" className="block">
          <StatCard icon={Package} label="Active products" value={loading ? '…' : String(summary?.totalProducts ?? 0)} hint="View catalogue" />
        </Link>
        <Link to="/inventory" className="block">
          <StatCard icon={Boxes} label="Units on hand" value={loading ? '…' : String(summary?.totalUnits ?? 0)} hint="Stock overview" />
        </Link>
        <Link to="/inventory" className="block">
          <StatCard icon={PackageSearch} label="Low stock" value={loading ? '…' : String(summary?.lowStock ?? 0)} hint="Needs reordering" tone="warning" />
        </Link>
        <Link to="/inventory" className="block">
          <StatCard
            icon={PackageX}
            label="Out of stock"
            value={loading ? '…' : String(summary?.outOfStock ?? 0)}
            hint={summary && summary.outOfStock > 0 ? 'Urgent — attention required' : 'Urgent'}
            tone="danger"
            pulse={!loading && (summary?.outOfStock ?? 0) > 0}
          />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {!loading && summary && summary.outOfStockItems.length > 0 ? (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" />
              Out-of-stock items
            </CardTitle>
            <CardDescription>
              {summary.outOfStockItems.length} product{summary.outOfStockItems.length === 1 ? '' : 's'} completely out of stock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {summary.outOfStockItems.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-muted-foreground text-xs">
                      SKU: {item.sku}
                      {item.partNumber ? <> · Part #: {item.partNumber}</> : null}
                    </p>
                    {item.brand ? (
                      <p className="text-muted-foreground text-xs">Brand: {item.brand}</p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {item.locationCode} — {item.locationName}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">0</Badge>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link to="/inventory?filter=out_of_stock" className="text-sm font-medium text-red-600 hover:underline">
                View all in inventory →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && summary && summary.recentMovements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent stock movements</CardTitle>
            <CardDescription>The latest entries in the inventory ledger.</CardDescription>
            <Link to="/inventory" className="text-zinc-600 hover:text-zinc-800 text-sm font-medium hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y">
              {summary.recentMovements.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Wrench className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.product.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {tx.location?.code ?? '—'} · {new Date(tx.createdAt).toLocaleString('en-GB')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={tx.quantity > 0 ? 'success' : 'destructive'}
                  >
                    {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Coming up next</CardTitle>
          <CardDescription>Modules being built out in upcoming stages — click to open.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {upcomingModules.map((module) => (
            <Link
              key={module.title}
              to={module.href}
              className="hover:border-primary/50 flex items-start gap-3 rounded-lg border p-4 transition-colors"
            >
              <module.icon className="text-zinc-500 mt-0.5 size-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{module.title}</p>
                <p className="text-xs text-muted-foreground">{module.description}</p>
              </div>
              <ArrowRight className="text-muted-foreground size-4" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <OutOfStockAlert
        open={oosAlertOpen}
        onOpenChange={setOosAlertOpen}
        items={summary?.outOfStockItems ?? []}
      />
    </div>
  )
}
