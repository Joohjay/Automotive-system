import { useCallback, useEffect, useState } from 'react'
import { Receipt, Search } from 'lucide-react'
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
import { listSales } from '@/services/sale.service'
import type { Sale, SaleStatus } from '@/types/sale'
import { SaleDetailDialog } from '@/components/sales/SaleDetailDialog'

const STATUS_BADGE: Record<SaleStatus, 'default' | 'success' | 'destructive' | 'secondary' | 'warning'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  VOID: 'destructive',
}

const STATUS_LABEL: Record<SaleStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  VOID: 'Voided',
}

const PAGE_SIZE = 10

export function SalesPage() {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'

  const [sales, setSales] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSales({
        search: debouncedSearch || undefined,
        status: (status as SaleStatus) || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setSales(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load sales')
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
        title="Sales history"
        description={`${total} sale${total === 1 ? '' : 's'} on record`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by receipt number or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status || undefined} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as SaleStatus[]).map((s) => (
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
        ) : sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales yet"
            description="Sales will appear here once the first transaction is completed."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs font-medium">{s.receiptNumber}</TableCell>
                  <TableCell className="font-medium">{s.customer?.name ?? 'Walk-in'}</TableCell>
                  <TableCell>{formatDateTime(s.saleDate)}</TableCell>
                  <TableCell>{s._count?.items ?? 0}</TableCell>
                  <TableCell className="text-right">{formatMoney(s.total, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(s.id)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination page={page} pages={pages} onPageChange={setPage} />

      <SaleDetailDialog
        saleId={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onChanged={() => void load()}
      />
    </div>
  )
}
