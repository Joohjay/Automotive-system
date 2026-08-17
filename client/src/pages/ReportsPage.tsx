import { useCallback, useEffect, useState } from 'react'
import { BarChart3, DollarSign, Package, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, formatDate } from '@/lib/format'
import { getSalesReport, getInventoryReport, getExpenseReport, getProfitLoss } from '@/services/report.service'

type Tab = 'sales' | 'inventory' | 'expenses' | 'pnl'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'sales', label: 'Sales', icon: <BarChart3 className="mr-2 h-4 w-4" /> },
  { key: 'inventory', label: 'Inventory', icon: <Package className="mr-2 h-4 w-4" /> },
  { key: 'expenses', label: 'Expenses', icon: <Receipt className="mr-2 h-4 w-4" /> },
  { key: 'pnl', label: 'P&L', icon: <DollarSign className="mr-2 h-4 w-4" /> },
]

function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function ReportsPage() {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'

  const [activeTab, setActiveTab] = useState<Tab>('sales')

  const [salesLoading, setSalesLoading] = useState(false)
  const [salesData, setSalesData] = useState<any>(null)
  const [salesFrom, setSalesFrom] = useState('')
  const [salesTo, setSalesTo] = useState('')

  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [inventoryData, setInventoryData] = useState<any>(null)

  const [expenseLoading, setExpenseLoading] = useState(false)
  const [expenseData, setExpenseData] = useState<any>(null)
  const [expenseFrom, setExpenseFrom] = useState('')
  const [expenseTo, setExpenseTo] = useState('')

  const [pnlLoading, setPnlLoading] = useState(false)
  const [pnlData, setPnlData] = useState<any>(null)
  const [pnlFrom, setPnlFrom] = useState('')
  const [pnlTo, setPnlTo] = useState('')

  const fetchSales = useCallback(async () => {
    try {
      setSalesLoading(true)
      const params: Record<string, string> = {}
      if (salesFrom) params.from = salesFrom
      if (salesTo) params.to = salesTo
      const res = await getSalesReport(params)
      setSalesData((res as any).data)
    } catch {
      toast.error('Failed to load sales report')
    } finally {
      setSalesLoading(false)
    }
  }, [salesFrom, salesTo])

  const fetchInventory = useCallback(async () => {
    try {
      setInventoryLoading(true)
      const res = await getInventoryReport()
      setInventoryData((res as any).data)
    } catch {
      toast.error('Failed to load inventory report')
    } finally {
      setInventoryLoading(false)
    }
  }, [])

  const fetchExpenses = useCallback(async () => {
    try {
      setExpenseLoading(true)
      const params: Record<string, string> = {}
      if (expenseFrom) params.from = expenseFrom
      if (expenseTo) params.to = expenseTo
      const res = await getExpenseReport(params)
      setExpenseData((res as any).data)
    } catch {
      toast.error('Failed to load expense report')
    } finally {
      setExpenseLoading(false)
    }
  }, [expenseFrom, expenseTo])

  const fetchPnl = useCallback(async () => {
    try {
      setPnlLoading(true)
      const params: Record<string, string> = {}
      if (pnlFrom) params.from = pnlFrom
      if (pnlTo) params.to = pnlTo
      const res = await getProfitLoss(params)
      setPnlData((res as any).data)
    } catch {
      toast.error('Failed to load profit & loss report')
    } finally {
      setPnlLoading(false)
    }
  }, [pnlFrom, pnlTo])

  useEffect(() => {
    if (activeTab === 'sales') fetchSales()
    else if (activeTab === 'inventory') fetchInventory()
    else if (activeTab === 'expenses') fetchExpenses()
    else if (activeTab === 'pnl') fetchPnl()
  }, [activeTab, fetchSales, fetchInventory, fetchExpenses, fetchPnl])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Sales, stock and financial analytics."
      />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={salesFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSalesFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={salesTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSalesTo(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={fetchSales} disabled={salesLoading}>
              Apply
            </Button>
          </div>

          {salesLoading ? (
            <div className="space-y-6">
              <SkeletonCards count={3} />
              <SkeletonTable rows={5} />
            </div>
          ) : salesData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">{salesData.totalSales ?? salesData.totalCount ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatMoney(salesData.totalRevenue ?? 0, currency)}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Total Discounts</p>
                  <p className="text-2xl font-bold">{formatMoney(salesData.totalDiscounts ?? 0, currency)}</p>
                </div>
              </div>

              {salesData.byPaymentMethod && salesData.byPaymentMethod.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">By Payment Method</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Method</th>
                          <th className="px-4 py-3 text-right font-medium">Count</th>
                          <th className="px-4 py-3 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.byPaymentMethod.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-4 py-3">{row.method ?? row.paymentMethod ?? '—'}</td>
                            <td className="px-4 py-3 text-right">{row.count ?? 0}</td>
                            <td className="px-4 py-3 text-right">{formatMoney(row.total ?? 0, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {salesData.topProducts && salesData.topProducts.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">Top Products</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Product</th>
                          <th className="px-4 py-3 text-right font-medium">Quantity Sold</th>
                          <th className="px-4 py-3 text-right font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.topProducts.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-4 py-3">{row.name ?? row.productName ?? '—'}</td>
                            <td className="px-4 py-3 text-right">{row.quantity ?? row.quantitySold ?? 0}</td>
                            <td className="px-4 py-3 text-right">{formatMoney(row.revenue ?? 0, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {salesData.dailySales && salesData.dailySales.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">Daily Sales</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Date</th>
                          <th className="px-4 py-3 text-right font-medium">Count</th>
                          <th className="px-4 py-3 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.dailySales.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-4 py-3">{row.date ? formatDate(row.date) : '—'}</td>
                            <td className="px-4 py-3 text-right">{row.count ?? 0}</td>
                            <td className="px-4 py-3 text-right">{formatMoney(row.total ?? 0, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <SkeletonCards count={3} />
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {inventoryLoading ? (
            <div className="space-y-6">
              <SkeletonCards count={4} />
              <SkeletonTable rows={5} />
            </div>
          ) : inventoryData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{inventoryData.totalProducts ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Total Units</p>
                  <p className="text-2xl font-bold">{inventoryData.totalUnits ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-amber-600">{inventoryData.lowStock ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{inventoryData.outOfStock ?? 0}</p>
                </div>
              </div>

              {inventoryData.byCategory && inventoryData.byCategory.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">By Category</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Category</th>
                          <th className="px-4 py-3 text-right font-medium">Product Count</th>
                          <th className="px-4 py-3 text-right font-medium">Total Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryData.byCategory.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-4 py-3">{row.name ?? row.category ?? '—'}</td>
                            <td className="px-4 py-3 text-right">{row.productCount ?? row.count ?? 0}</td>
                            <td className="px-4 py-3 text-right">{row.totalUnits ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <SkeletonCards count={4} />
          )}
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={expenseFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={expenseTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseTo(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={fetchExpenses} disabled={expenseLoading}>
              Apply
            </Button>
          </div>

          {expenseLoading ? (
            <div className="space-y-6">
              <SkeletonCards count={1} />
              <SkeletonTable rows={5} />
            </div>
          ) : expenseData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold">{formatMoney(expenseData.totalExpenses ?? 0, currency)}</p>
                </div>
              </div>

              {expenseData.byCategory && expenseData.byCategory.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">By Category</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Category</th>
                          <th className="px-4 py-3 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseData.byCategory.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-4 py-3">{row.name ?? row.category ?? '—'}</td>
                            <td className="px-4 py-3 text-right">{formatMoney(row.total ?? 0, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {expenseData.byPaymentMethod && expenseData.byPaymentMethod.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">By Payment Method</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Method</th>
                          <th className="px-4 py-3 text-right font-medium">Count</th>
                          <th className="px-4 py-3 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseData.byPaymentMethod.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-4 py-3">{row.method ?? row.paymentMethod ?? '—'}</td>
                            <td className="px-4 py-3 text-right">{row.count ?? 0}</td>
                            <td className="px-4 py-3 text-right">{formatMoney(row.total ?? 0, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <SkeletonCards count={1} />
          )}
        </div>
      )}

      {activeTab === 'pnl' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={pnlFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPnlFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={pnlTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPnlTo(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={fetchPnl} disabled={pnlLoading}>
              Apply
            </Button>
          </div>

          {pnlLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : pnlData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-6">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="mt-1 text-3xl font-bold text-green-600">
                  {formatMoney(pnlData.revenue ?? 0, currency)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <p className="text-sm text-muted-foreground">Cost of Goods Sold</p>
                <p className="mt-1 text-3xl font-bold text-red-600">
                  {formatMoney(pnlData.cogs ?? 0, currency)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="mt-1 text-3xl font-bold text-red-600">
                  {formatMoney(pnlData.expenses ?? 0, currency)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p
                  className={`mt-1 text-3xl font-bold ${
                    (pnlData.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatMoney(pnlData.netProfit ?? 0, currency)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
