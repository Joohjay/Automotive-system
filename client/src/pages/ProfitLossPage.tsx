import { useCallback, useEffect, useState } from 'react'
import { DollarSign, TrendingUp, PieChart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { toastErrorMessage } from '@/lib/errors'
import { getProfitLoss, type ProfitLossReport } from '@/services/report.service'

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
}

export function ProfitLossPage() {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ProfitLossReport | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      setData(await getProfitLoss(params))
    } catch (err) {
      toast.error(toastErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void fetchData() }, [fetchData])

  const daily = data?.daily ?? []
  const byCategory = data?.byCategory ?? []
  const totalExpenses = Number(data?.expenses ?? 0)
  const scale = Math.max(
    1,
    ...daily.map((d) => Number(d.revenue) + Number(d.expenses)),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description="Revenue, costs, and net profit overview."
        actions={<DollarSign className="size-5 text-muted-foreground" />}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm font-medium">From</label>
          <Input type="date" value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">To</label>
          <Input type="date" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} className="mt-1" />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          Apply
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="mt-1 text-3xl font-bold text-green-600">
                {formatMoney(data.revenue ?? 0, currency)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">Cost of Goods Sold</p>
              <p className="mt-1 text-3xl font-bold text-red-600">
                {formatMoney(data.cogs ?? 0, currency)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="mt-1 text-3xl font-bold text-red-600">
                {formatMoney(data.expenses ?? 0, currency)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">Gross Profit</p>
              <p
                className={`mt-1 text-3xl font-bold ${
                  Number(data.grossProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatMoney(data.grossProfit ?? 0, currency)}
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Net Profit</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                Number(data.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatMoney(data.netProfit ?? 0, currency)}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="text-muted-foreground size-5" />
                Revenue vs expenses
              </CardTitle>
              <CardDescription>
                Daily revenue and expenses for the selected period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {daily.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No activity in the selected period.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="bg-emerald-500 inline-block size-2.5 rounded-full" /> Revenue
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="bg-red-500 inline-block size-2.5 rounded-full" /> Expenses
                    </span>
                  </div>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {daily.map((d) => {
                      const rev = Number(d.revenue)
                      const exp = Number(d.expenses)
                      const dayTotal = rev + exp
                      return (
                        <div key={d.date} className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-xs text-muted-foreground">{dayLabel(d.date)}</span>
                          <div className="flex h-3 min-w-0 flex-1 gap-0.5 overflow-hidden rounded">
                            <div
                              className="bg-emerald-500 h-full rounded-l"
                              style={{ width: `${(rev / scale) * 100}%` }}
                              title={`Revenue ${formatMoney(rev, currency)}`}
                            />
                            <div
                              className="bg-red-500 h-full rounded-r"
                              style={{ width: `${(exp / scale) * 100}%` }}
                              title={`Expenses ${formatMoney(exp, currency)}`}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums">
                            {formatMoney(dayTotal, currency)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="text-muted-foreground size-5" />
                Expense breakdown
              </CardTitle>
              <CardDescription>
                How the {formatMoney(totalExpenses, currency)} of expenses is distributed by category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {byCategory.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No expenses recorded in the selected period.
                </p>
              ) : (
                <div className="space-y-3">
                  {byCategory.map((c) => {
                    const value = Number(c.total)
                    const pct = totalExpenses > 0 ? (value / totalExpenses) * 100 : 0
                    return (
                      <div key={c.categoryId}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate">{c.name}</span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {formatMoney(value, currency)} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          title="No profit & loss data"
          description="Choose a period and run the report to see revenue, cost of goods sold, and profit."
        />
      )}
    </div>
  )
}