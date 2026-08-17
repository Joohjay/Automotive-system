import { useCallback, useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, formatDate } from '@/lib/format'
import { listShifts, openShift, closeShift, getShiftSummary } from '@/services/shift.service'
import type { Shift, ShiftSummary } from '@/types/shift'
import type { Paginated } from '@/types/product'

type ShiftFilter = 'ALL' | 'OPEN' | 'CLOSED'

export function ShiftsPage() {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'

  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<Paginated<Shift> | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ShiftFilter>('ALL')

  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [summary, setSummary] = useState<ShiftSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [openingCash, setOpeningCash] = useState('')
  const [openNotes, setOpenNotes] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string | number> = { page, pageSize: 15 }
      if (statusFilter !== 'ALL') params.status = statusFilter
      const res = await listShifts(params as Record<string, string>)
      setShifts(res)
    } catch {
      toast.error('Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  const fetchActiveShift = useCallback(async () => {
    try {
      const res = await getShiftSummary()
      setActiveShift(res.openShift ?? null)
      if (res.openShift) {
        setSummary(res)
      } else {
        setSummary(null)
      }
    } catch {
      setActiveShift(null)
      setSummary(null)
    }
  }, [])

  useEffect(() => {
    void fetchShifts()
  }, [fetchShifts])

  useEffect(() => {
    void fetchActiveShift()
  }, [fetchActiveShift])

  useEffect(() => {
    if (activeShift) {
      setSummaryLoading(true)
      const interval = setInterval(async () => {
        try {
          const res = await getShiftSummary()
          setActiveShift(res.openShift ?? null)
          if (res.openShift) setSummary(res)
        } catch {
          /* silent */
        } finally {
          setSummaryLoading(false)
        }
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [activeShift])

  const handleOpenShift = async () => {
    const cash = parseFloat(openingCash)
    if (isNaN(cash) || cash < 0) {
      toast.error('Enter a valid opening cash amount')
      return
    }
    try {
      setSubmitting(true)
      await openShift({ openingCash: cash, notes: openNotes || null })
      toast.success('Shift opened successfully')
      setOpenDialogOpen(false)
      setOpeningCash('')
      setOpenNotes('')
      await fetchActiveShift()
      await fetchShifts()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open shift'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseShift = async () => {
    if (!activeShift) return
    const cash = parseFloat(closingCash)
    if (isNaN(cash) || cash < 0) {
      toast.error('Enter a valid closing cash amount')
      return
    }
    try {
      setSubmitting(true)
      await closeShift(activeShift.id, { actualClosingCash: cash, notes: closeNotes || null })
      toast.success('Shift closed successfully')
      setCloseDialogOpen(false)
      setClosingCash('')
      setCloseNotes('')
      await fetchActiveShift()
      await fetchShifts()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to close shift'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const expectedClosing = activeShift
    ? Number(activeShift.openingCash) + (summary?.totalCashReceived ?? 0)
    : 0
  const diffValue = parseFloat(closingCash || '0') - expectedClosing

  const totalPages = shifts ? shifts.pagination.pages : 1

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Shifts"
        description="Cashier shift open, close and cash reconciliation."
        actions={
          !activeShift ? (
            <Button onClick={() => setOpenDialogOpen(true)}>
              <Unlock className="mr-2 h-4 w-4" />
              Open Shift
            </Button>
          ) : (
            <Button onClick={() => setCloseDialogOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Close Shift
            </Button>
          )
        }
      />

      {activeShift && (
        <div className="rounded-lg border-2 border-green-400 bg-green-50 p-5 dark:border-green-600 dark:bg-green-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/50">
                <Unlock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Active Shift
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Open since {formatDate(activeShift.openedAt)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-600 dark:text-green-400">Opening Cash</p>
              <p className="font-semibold text-green-800 dark:text-green-200">
                {formatMoney(Number(activeShift.openingCash), currency)}
              </p>
            </div>
          </div>

          {summary && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md bg-white p-3 dark:bg-green-900/20">
                <p className="text-xs text-green-600 dark:text-green-400">Total Sales</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-5 w-20" />
                ) : (
                  <p className="text-lg font-bold text-green-800 dark:text-green-200">
                    {formatMoney(summary.totalSales ?? 0, currency)}
                  </p>
                )}
              </div>
              <div className="rounded-md bg-white p-3 dark:bg-green-900/20">
                <p className="text-xs text-green-600 dark:text-green-400">Cash Received</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-5 w-20" />
                ) : (
                  <p className="text-lg font-bold text-green-800 dark:text-green-200">
                    {formatMoney(summary.totalCashReceived ?? 0, currency)}
                  </p>
                )}
              </div>
              <div className="rounded-md bg-white p-3 dark:bg-green-900/20">
                <p className="text-xs text-green-600 dark:text-green-400">MPesa Received</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-5 w-20" />
                ) : (
                  <p className="text-lg font-bold text-green-800 dark:text-green-200">
                    {formatMoney(summary.totalMpesaReceived ?? 0, currency)}
                  </p>
                )}
              </div>
              <div className="rounded-md bg-white p-3 dark:bg-green-900/20">
                <p className="text-xs text-green-600 dark:text-green-400">Transactions</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-5 w-12" />
                ) : (
                  <p className="text-lg font-bold text-green-800 dark:text-green-200">
                    {summary.transactionCount ?? 0}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {(['ALL', 'OPEN', 'CLOSED'] as ShiftFilter[]).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(s); setPage(1) }}
          >
            {s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !shifts || shifts.data.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="No shifts found"
          description="No shifts match the current filter."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Opened</th>
                  <th className="px-4 py-3 text-left font-medium">Closed</th>
                  <th className="px-4 py-3 text-left font-medium">Cashier</th>
                  <th className="px-4 py-3 text-right font-medium">Opening Cash</th>
                  <th className="px-4 py-3 text-right font-medium">Expected Closing</th>
                  <th className="px-4 py-3 text-right font-medium">Actual Closing</th>
                  <th className="px-4 py-3 text-right font-medium">Difference</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.data.map((shift) => {
                  const diff = shift.actualClosingCash != null && shift.expectedClosingCash != null
                    ? Number(shift.actualClosingCash) - Number(shift.expectedClosingCash)
                    : null
                  return (
                    <tr key={shift.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">{formatDate(shift.openedAt)}</td>
                      <td className="px-4 py-3">{shift.closedAt ? formatDate(shift.closedAt) : '—'}</td>
                      <td className="px-4 py-3">{shift.createdBy?.fullName ?? '—'}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(Number(shift.openingCash), currency)}</td>
                      <td className="px-4 py-3 text-right">
                        {shift.expectedClosingCash != null ? formatMoney(Number(shift.expectedClosingCash), currency) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {shift.actualClosingCash != null ? formatMoney(Number(shift.actualClosingCash), currency) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {diff !== null ? (
                          <span className={diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : ''}>
                            {formatMoney(diff, currency)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={shift.status === 'OPEN' ? 'default' : 'secondary'}>
                          {shift.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {shifts.pagination.page} of {totalPages} ({shifts.pagination.total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={shifts.pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={shifts.pagination.page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Opening Cash</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={openingCash}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpeningCash(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                placeholder="Any notes..."
                value={openNotes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpenNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOpenShift} disabled={submitting}>
              {submitting ? 'Opening...' : 'Open Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">Expected Closing Cash</p>
              <p className="text-lg font-semibold">{formatMoney(expectedClosing, currency)}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Actual Closing Cash</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={closingCash}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClosingCash(e.target.value)}
                className="mt-1"
              />
            </div>
            {closingCash && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">Difference</p>
                <p
                  className={`text-lg font-semibold ${
                    diffValue < 0 ? 'text-red-600' : diffValue > 0 ? 'text-green-600' : ''
                  }`}
                >
                  {diffValue < 0 ? 'Shortage: ' : diffValue > 0 ? 'Overage: ' : 'Balanced: '}
                  {formatMoney(Math.abs(diffValue), currency)}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                placeholder="Any notes..."
                value={closeNotes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCloseNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCloseShift} disabled={submitting}>
              {submitting ? 'Closing...' : 'Close Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
