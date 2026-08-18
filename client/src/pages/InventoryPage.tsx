import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, Loader2, PackageSearch, PackageX, SlidersHorizontal, X, Wrench } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { formatDateTime } from '@/lib/format'
import {
  createAdjustment,
  getInventorySummary,
  listTransactions,
  listStock,
} from '@/services/inventory.service'
import { listLocations } from '@/services/referenceData.service'
import { listProducts } from '@/services/product.service'
import type { InventorySummary, InventoryTransaction, StockRow, TransactionType } from '@/types/inventory'
import type { Product, StorageLocation } from '@/types/product'

const TX_TYPE_LABEL: Record<string, string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  RETURN: 'Return',
  DAMAGE: 'Damage',
  ADJUSTMENT: 'Adjustment',
  TRANSFER: 'Transfer',
}

const TX_TYPE_BADGE: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PURCHASE: 'success',
  RETURN: 'success',
  SALE: 'destructive',
  DAMAGE: 'destructive',
  ADJUSTMENT: 'warning',
  TRANSFER: 'secondary',
}

function AdjustmentDialog({
  open,
  onOpenChange,
  initialProductId,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProductId?: string
  onDone: () => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [productId, setProductId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setNewQuantity('')
    setReason('')
    void (async () => {
      const [prods, locs] = await Promise.all([
        listProducts({ status: 'ACTIVE', pageSize: 200 }),
        listLocations(),
      ])
      setProducts(prods.data)
      setLocations(locs)
      setProductId(initialProductId && prods.data.some((p) => p.id === initialProductId) ? initialProductId : '')
      setLocationId(locs[0]?.id ?? '')
    })()
  }, [open, initialProductId])

  const currentQty =
    products.find((p) => p.id === productId)?.stock.quantityOnHand ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!productId || !locationId) {
      setError('Select a product and a location.')
      return
    }
    const qty = Number(newQuantity)
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Quantity must be a non-negative number.')
      return
    }
    if (!reason.trim()) {
      setError('A reason is required.')
      return
    }
    setSaving(true)
    try {
      await createAdjustment({
        productId,
        locationId,
        newQuantity: qty,
        reason: reason.trim(),
      })
      toast.success('Stock adjusted')
      onDone()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Set the actual quantity counted on the shelf. A ledger entry is created.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId || undefined} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={locationId || undefined} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.code} — {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-qty">New quantity on hand</Label>
            <Input
              id="adj-qty"
              type="number"
              min="0"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              placeholder={currentQty === null ? undefined : `Current: ${currentQty}`}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason || undefined} onValueChange={(v) => setReason(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Stock Count Correction">Stock Count Correction</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
                <SelectItem value="Lost">Lost</SelectItem>
                <SelectItem value="Found">Found</SelectItem>
                <SelectItem value="Supplier Error">Supplier Error</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function InventoryPage() {
  const { hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canAdjust = hasPermission('inventory.adjust')

  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)

  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPages, setTxPages] = useState(1)
  const [txPage, setTxPage] = useState(1)
  const [txType, setTxType] = useState('')
  const [loadingTx, setLoadingTx] = useState(true)

  const [adjustOpen, setAdjustOpen] = useState(
    Boolean(searchParams.get('product')),
  )
  const preSelectedProduct = searchParams.get('product') ?? undefined

  const lowStockRows = useMemo(
    () =>
      stockRows.filter(
        (r) => r.quantityOnHand <= r.product.minStockLevel,
      ),
    [stockRows],
  )

  const stockFilter = searchParams.get('filter')
  const filteredStockRows = useMemo(() => {
    if (stockFilter === 'out_of_stock') {
      return stockRows.filter((r) => r.quantityOnHand <= 0)
    }
    return stockRows
  }, [stockRows, stockFilter])

  useEffect(() => {
    void (async () => {
      setLoadingSummary(true)
      try {
        const [s, rows] = await Promise.all([getInventorySummary(), listStock()])
        setSummary(s)
        setStockRows(rows)
      } catch {
        toast.error('Failed to load inventory')
      } finally {
        setLoadingSummary(false)
      }
    })()
  }, [adjustOpen])

  const loadTransactions = useCallback(async () => {
    setLoadingTx(true)
    try {
      const res = await listTransactions({
        type: (txType as TransactionType) || undefined,
        page: txPage,
        pageSize: 15,
      })
      setTransactions(res.data)
      setTxTotal(res.pagination.total)
      setTxPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setLoadingTx(false)
    }
  }, [txType, txPage])

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    setTxPage(1)
  }, [txType])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels, adjustments and movement ledger"
        actions={
          canAdjust ? (
            <Button
              onClick={() => {
                setSearchParams({})
                setAdjustOpen(true)
              }}
            >
              <SlidersHorizontal /> Adjust stock
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ledger">Movement ledger</TabsTrigger>
        </TabsList>

        {stockFilter === 'out_of_stock' ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm">
            <PackageX className="size-4 text-red-600" />
            <span className="font-medium text-red-700">Showing out-of-stock items only</span>
            <span className="text-muted-foreground">({filteredStockRows.length} product{filteredStockRows.length === 1 ? '' : 's'})</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto gap-1 text-red-600 hover:text-red-700"
              onClick={() => setSearchParams({})}
            >
              <X className="size-3" />
              Clear filter
            </Button>
          </div>
        ) : null}

        <TabsContent value="overview" className="mt-4 space-y-6">
          {loadingSummary || !summary ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Boxes} label="Active products" value={String(summary.totalProducts)} />
              <StatCard icon={PackageSearch} label="Units on hand" value={String(summary.totalUnits)} />
              <StatCard icon={PackageX} label="Low stock" value={String(summary.lowStock)} tone="warning" />
              <StatCard icon={Wrench} label="Out of stock" value={String(summary.outOfStock)} tone="danger" />
            </div>
          )}

          <div className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="text-sm font-semibold">
                {stockFilter === 'out_of_stock' ? 'Out-of-stock items' : 'Low stock alerts'}
              </h2>
              <p className="text-muted-foreground text-xs">
                {stockFilter === 'out_of_stock'
                  ? 'Products with zero quantity on hand'
                  : 'Items at or below their minimum stock level'}
              </p>
            </div>
            {loadingSummary ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : filteredStockRows.length === 0 ? (
              <EmptyState icon={PackageSearch} title={stockFilter === 'out_of_stock' ? 'No out-of-stock items' : 'All stock levels healthy'} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead>Min level</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStockRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.product.sku}</TableCell>
                      <TableCell className="font-medium">{r.product.name}</TableCell>
                      <TableCell>
                        <Badge variant={r.quantityOnHand <= 0 ? 'destructive' : 'warning'}>
                          {r.quantityOnHand}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.product.minStockLevel}</TableCell>
                      <TableCell>
                        {r.location.code} — {r.location.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {canAdjust ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSearchParams({ product: r.product.id })
                              setAdjustOpen(true)
                            }}
                          >
                            Adjust
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {summary && summary.recentReceived.length > 0 ? (
            <div className="rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="text-sm font-semibold">Recent stock-in</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentReceived.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {tx.product.name} <span className="text-muted-foreground text-xs">({tx.product.sku})</span>
                      </TableCell>
                      <TableCell className="font-medium">+{tx.quantity}</TableCell>
                      <TableCell>{tx.location?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(tx.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="ledger" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Select value={txType || undefined} onValueChange={setTxType}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TX_TYPE_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{txTotal} entries</p>
          </div>

          <div className="rounded-xl border bg-card">
            {loadingTx ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState icon={Boxes} title="No movements recorded" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant={TX_TYPE_BADGE[tx.type] ?? 'secondary'}>
                          {TX_TYPE_LABEL[tx.type] ?? tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.product.name}
                        <span className="text-muted-foreground text-xs"> ({tx.product.sku})</span>
                      </TableCell>
                      <TableCell className={tx.quantity > 0 ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </TableCell>
                      <TableCell>{tx.location?.code ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-56 truncate">{tx.note ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(tx.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <Pagination page={txPage} pages={txPages} onPageChange={setTxPage} />
        </TabsContent>
      </Tabs>

      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={(open) => {
          setAdjustOpen(open)
          if (!open) setSearchParams({})
        }}
        initialProductId={preSelectedProduct}
        onDone={() => {
          void (async () => {
            const [s, rows] = await Promise.all([getInventorySummary(), listStock()])
            setSummary(s)
            setStockRows(rows)
          })()
        }}
      />
    </div>
  )
}