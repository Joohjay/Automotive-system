import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { formatDateTime, formatMoney } from '@/lib/format'
import { listReturns } from '@/services/return.service'
import type { Return, ReturnStatus } from '@/types/return'
import { ReturnFormDialog } from '@/components/returns/ReturnFormDialog'

const STATUS_BADGE: Record<ReturnStatus, 'default' | 'success' | 'destructive' | 'secondary' | 'warning'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'secondary',
}

const STATUS_LABEL: Record<ReturnStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const PAGE_SIZE = 10

export function ReturnsPage() {
  const { hasPermission, settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const canReturn = hasPermission('sale.return')

  const [returns, setReturns] = useState<Return[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listReturns({
        search: debouncedSearch || undefined,
        status: (status as ReturnStatus) || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setReturns(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load returns')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns"
        description={`${total} return${total === 1 ? '' : 's'} on record`}
        actions={
          canReturn ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus /> New return
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by return number or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status || undefined} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as ReturnStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : returns.length === 0 ? (
          <EmptyState
            icon={Undo2}
            title="No returns"
            description="Process a return to restock goods and issue a refund."
            action={
              canReturn ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus /> New return
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return no.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Source sale</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-medium">{r.returnNumber}</TableCell>
                  <TableCell className="font-medium">{r.customer?.name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.sale?.receiptNumber ?? 'Walk-in'}
                  </TableCell>
                  <TableCell>{formatDateTime(r.returnDate)}</TableCell>
                  <TableCell>{r._count?.items ?? 0}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.totalRefund, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination page={page} pages={pages} onPageChange={setPage} />

      <ReturnFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={() => void load()} />
    </div>
  )
}
