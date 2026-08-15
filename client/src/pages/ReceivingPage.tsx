import { useCallback, useEffect, useState } from 'react'
import { PackageOpen, Plus, Search, Truck } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { formatDate, formatMoney } from '@/lib/format'
import { cancelPurchase, listPurchases } from '@/services/purchase.service'
import type { Purchase, PurchaseStatus } from '@/types/purchase'
import { PurchaseFormDialog } from '@/components/receiving/PurchaseFormDialog'
import { ReceiveDialog } from '@/components/receiving/ReceiveDialog'

const STATUS_BADGE: Record<PurchaseStatus, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  PARTIALLY_RECEIVED: 'default',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
}

const STATUS_LABEL: Record<PurchaseStatus, string> = {
  PENDING: 'Pending',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

const PAGE_SIZE = 10

export function ReceivingPage() {
  const { hasPermission, settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const canCreate = hasPermission('purchase.create')
  const canReceive = hasPermission('purchase.receive')
  const canCancel = hasPermission('purchase.cancel')

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')

  const [poOpen, setPoOpen] = useState(false)
  const [receiveFor, setReceiveFor] = useState<string | null>(null)
  const [cancelFor, setCancelFor] = useState<Purchase | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listPurchases({
        search: debouncedSearch || undefined,
        status: (status as PurchaseStatus) || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setPurchases(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load purchase orders')
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

  async function handleCancel() {
    if (!cancelFor) return
    setCancelling(true)
    try {
      await cancelPurchase(cancelFor.id)
      toast.success('Purchase order cancelled')
      setCancelFor(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Receiving"
        description={`${total} purchase order${total === 1 ? '' : 's'} on record`}
        actions={
          canCreate ? (
            <Button onClick={() => setPoOpen(true)}>
              <Plus /> New purchase order
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by reference or supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status || undefined} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as PurchaseStatus[]).map((s) => (
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
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No purchase orders"
            description="Create a purchase order to receive goods into stock."
            action={
              canCreate ? (
                <Button onClick={() => setPoOpen(true)}>
                  <Plus /> New purchase order
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-medium">{p.reference}</TableCell>
                  <TableCell className="font-medium">{p.supplier.name}</TableCell>
                  <TableCell>{formatDate(p.purchaseDate)}</TableCell>
                  <TableCell>{p._count?.items ?? 0}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.total, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canReceive && (p.status === 'PENDING' || p.status === 'PARTIALLY_RECEIVED') ? (
                        <Button variant="ghost" size="sm" onClick={() => setReceiveFor(p.id)}>
                          <PackageOpen /> Receive
                        </Button>
                      ) : null}
                      {canCancel && p.status === 'PENDING' ? (
                        <Button variant="ghost" size="sm" onClick={() => setCancelFor(p)}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination page={page} pages={pages} onPageChange={setPage} />

      <PurchaseFormDialog
        open={poOpen}
        onOpenChange={setPoOpen}
        onSaved={() => void load()}
      />

      <ReceiveDialog
        purchaseId={receiveFor}
        open={receiveFor !== null}
        onOpenChange={(open) => {
          if (!open) setReceiveFor(null)
        }}
        onDone={() => void load()}
      />

      <AlertDialog open={cancelFor !== null} onOpenChange={(open) => !open && setCancelFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelFor?.reference} from {cancelFor?.supplier.name} will be cancelled. This cannot be
              undone once goods have been received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault()
                void handleCancel()
              }}
            >
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}