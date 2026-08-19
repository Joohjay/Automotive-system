import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Package,
  PackageSearch,
  PackageX,
  Plus,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

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
import { getExpenseReport, getSalesReport } from '@/services/report.service'
import { OutOfStockAlert } from '@/components/OutOfStockAlert'
import { formatMoney } from '@/lib/format'
import type { InventorySummary } from '@/types/inventory'
import type { ExpenseReport, SalesReport } from '@/services/report.service'

let oosAlertShownThisSession = false

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface QuickAction {
  label: string
  description: string
  href: string
  icon: typeof ShoppingCart
  permission: string
}

const quickActions: QuickAction[] = [
  { label: 'New sale', description: 'Open the point of sale', href: '/pos', icon: ShoppingCart, permission: 'sale.create' },
  { label: 'Add product', description: 'Create a catalogue item', href: '/products', icon: Plus, permission: 'product.create' },
  { label: 'New purchase', description: 'Raise a purchase order', href: '/receiving', icon: Receipt, permission: 'purchase.create' },
  { label: 'Add customer', description: 'Register a credit customer', href: '/customers', icon: Users, permission: 'customer.manage' },
]

export function DashboardPage() {
  const health = useApiHealth()
  const { user, settings, hasPermission } = useAuth()
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [sales, setSales] = useState<SalesReport | null>(null)
  const [expenses, setExpenses] = useState<ExpenseReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [oosAlertOpen, setOosAlertOpen] = useState(false)
  const alertTriggeredRef = useRef(false)

  const canViewReports = hasPermission('report.view')
  const canViewExpenses = hasPermission('expense.view')
  const canViewInventory = hasPermission('inventory.view')

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    const weekAgo = new Date()
    weekAgo.setDate(today.getDate() - 6)
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const requests: Promise<unknown>[] = []
    if (canViewInventory) requests.push(getInventorySummary())
    if (canViewReports) requests.push(getSalesReport({ from: localDateString(weekAgo), to: localDateString(today) }))
    if (canViewExpenses) requests.push(getExpenseReport({ from: localDateString(firstOfMonth), to: localDateString(today) }))

    try {
      const [summaryRes, salesRes, expensesRes] = await Promise.all(requests)
      if (canViewInventory) setSummary(summaryRes as InventorySummary)
      if (canViewReports) setSales(salesRes as SalesReport)
      if (canViewExpenses) setExpenses(expensesRes as ExpenseReport)
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [canViewInventory, canViewReports, canViewExpenses])

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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const today = localDateString(new Date())
  const todaySales = sales?.dailySales.find((d) => localDateString(new Date(d.date)) === today)
  const maxDayTotal = Math.max(
    1,
    ...(sales?.dailySales.map((d) => Number(d.total)) ?? [1]),
  )
  const visibleActions = quickActions.filter((a) => hasPermission(a.permission))
  const currency = settings?.currency ?? 'TZS'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {user?.fullName?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {settings?.businessName} — {currency} · {health.status === 'ok' ? 'online' : 'offline'}
          </p>
        </div>
        {health.status === 'ok' && (
          <Badge variant={health.data.database === 'up' ? 'success' : 'warning'} className="w-fit">
            {health.data.database === 'up' ? 'System online' : 'Database offline'}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canViewReports ? (
          <Link to="/reports" className="block">
            <StatCard
              icon={TrendingUp}
              label="Sales revenue"
              value={loading ? '…' : formatMoney(sales?.totalRevenue ?? 0, currency)}
              hint={sales ? `${sales.totalSales} orders · last 7 days` : 'Last 7 days'}
              tone="success"
            />
          </Link>
        ) : null}
        {canViewInventory ? (
          <>
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
          </>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {!loading && canViewReports && sales ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="text-muted-foreground size-5" />
              Sales performance
            </CardTitle>
            <CardDescription>
              {todaySales
                ? `${todaySales.count} order${todaySales.count === 1 ? '' : 's'} today · ${formatMoney(todaySales.total, currency)}`
                : 'No sales recorded today yet.'}{' '}
              — last 7 days, including discounts of {formatMoney(sales.totalDiscounts, currency)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Daily revenue</p>
              <div className="flex flex-col gap-2">
                {sales.dailySales.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">No sales in the selected period.</p>
                ) : (
                  sales.dailySales.map((d) => {
                    const total = Number(d.total)
                    const pct = Math.round((total / maxDayTotal) * 100)
                    return (
                      <div key={d.date} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-muted-foreground">{dayLabel(d.date)}</span>
                        <div className="bg-muted h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">
                          {formatMoney(total, currency)}
                        </span>
                        <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
                          {d.count}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Top sellers</p>
              {sales.topProducts.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">No products sold yet.</p>
              ) : (
                <div className="flex flex-col divide-y">
                  {sales.topProducts.slice(0, 5).map((p) => (
                    <div key={p.productId} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-muted-foreground text-xs">{p.quantity} units sold</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(p.revenue, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && canViewExpenses && expenses ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="text-muted-foreground size-5" />
              Expenses this month
            </CardTitle>
            <CardDescription>
              Total {formatMoney(expenses.totalExpenses, currency)} across{' '}
              {expenses.byCategory.length} categor{expenses.byCategory.length === 1 ? 'y' : 'ies'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.byCategory.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">No expenses recorded this month.</p>
            ) : (
              <div className="flex flex-col divide-y">
                {expenses.byCategory.slice(0, 5).map((c) => (
                  <div key={c.categoryId} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate text-sm">{c.name}</span>
                    <span className="text-sm font-medium tabular-nums">{formatMoney(c.total, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!loading && canViewInventory && summary && summary.outOfStockItems.length > 0 ? (
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

      {!loading && canViewInventory && summary && summary.lowStockItems.length > 0 ? (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <PackageSearch className="size-5" />
              Low stock items
            </CardTitle>
            <CardDescription>
              {summary.lowStockItems.length} product{summary.lowStockItems.length === 1 ? '' : 's'} at or below their minimum level.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {summary.lowStockItems.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
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
                  <Badge variant="warning" className="shrink-0">
                    {item.quantityOnHand} / min {item.minStockLevel}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link to="/inventory" className="text-sm font-medium text-amber-600 hover:underline">
                View all in inventory →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && canViewInventory && summary && summary.recentMovements.length > 0 ? (
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

      {!loading && visibleActions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Shortcuts to the most common operations.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleActions.map((action) => (
              <Link
                key={action.href}
                to={action.href}
                className="hover:border-primary/50 hover:bg-muted/50 flex items-start gap-3 rounded-lg border p-4 transition-colors"
              >
                <action.icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-muted-foreground text-xs">{action.description}</p>
                </div>
                <ArrowRight className="text-muted-foreground size-4" />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <OutOfStockAlert
        open={oosAlertOpen}
        onOpenChange={setOosAlertOpen}
        items={summary?.outOfStockItems ?? []}
      />
    </div>
  )
}