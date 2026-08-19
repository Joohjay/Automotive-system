import { useCallback, useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { toastErrorMessage } from '@/lib/errors'
import { getProfitLoss, type ProfitLossReport } from '@/services/report.service'

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
