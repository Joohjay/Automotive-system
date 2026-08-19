import { useCallback, useEffect, useState } from 'react'
import { PackageSearch, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StockBadge } from '@/components/stock/StockBadge'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { toastErrorMessage } from '@/lib/errors'
import { listProducts, setProductStatus } from '@/services/product.service'
import { listBrands, listCategories } from '@/services/referenceData.service'
import type { Brand, Category, Product } from '@/types/product'
import { ProductFormDialog } from '@/components/products/ProductFormDialog'

const PAGE_SIZE = 10

export function ProductsPage() {
  const { hasPermission, settings } = useAuth()
  const navigate = useNavigate()
  const currency = settings?.currency ?? 'TZS'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [status, setStatus] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [statusTarget, setStatusTarget] = useState<Product | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  const canCreate = hasPermission('product.create')
  const canUpdate = hasPermission('product.update')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    void (async () => {
      const [c, b] = await Promise.all([listCategories(), listBrands()])
      setCategories(c)
      setBrands(b)
    })()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listProducts({
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        status: (status as 'ACTIVE' | 'INACTIVE') || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setProducts(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, categoryId, brandId, status, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryId, brandId, status])

  async function confirmStatusChange() {
    if (!statusTarget || statusBusy) return
    const p = statusTarget
    setStatusBusy(true)
    try {
      await setProductStatus(p.id, p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      toast.success(p.status === 'ACTIVE' ? 'Product deactivated' : 'Product activated')
      setStatusTarget(null)
      void load()
    } catch (err) {
      toast.error(toastErrorMessage(err))
    } finally {
      setStatusBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description={`${total} part${total === 1 ? '' : 's'} in the catalogue`}
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus /> Add product
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name, SKU, part number or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryId || undefined} onValueChange={setCategoryId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brandId || undefined} onValueChange={setBrandId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status || undefined} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
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
        ) : products.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No products found"
            description="Add your first spare part, or adjust the search and filters."
            action={
              canCreate ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setDialogOpen(true)
                  }}
                >
                  <Plus /> Add product
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Part #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.partNumber ?? '—'}</TableCell>
                  <TableCell className="max-w-64 truncate font-medium">{p.name}</TableCell>
                  <TableCell>{p.category?.name ?? '—'}</TableCell>
                  <TableCell>{p.brand?.name ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.purchasePrice, currency)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.sellingPrice, currency)}</TableCell>
                  <TableCell>
                    <StockBadge quantityOnHand={p.stock.quantityOnHand} minStockLevel={p.minStockLevel} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(p)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/inventory?product=${p.id}`)}
                      >
                        Stock
                      </Button>
                      {canUpdate ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStatusTarget(p)}
                        >
                          {p.status === 'ACTIVE' ? 'Disable' : 'Enable'}
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

      <div className="flex items-center justify-end">
        <Pagination page={page} pages={pages} onPageChange={setPage} />
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        onSaved={() => void load()}
      />

      <AlertDialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open && !statusBusy) setStatusTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.status === 'ACTIVE' ? 'Disable product?' : 'Enable product?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.status === 'ACTIVE' ? (
                <>
                  <strong>{statusTarget.name}</strong> will no longer appear in the catalogue or
                  point of sale. Stock on hand is preserved and the product can be re-enabled later.
                </>
              ) : (
                <>
                  <strong>{statusTarget?.name}</strong> will become available again in the
                  catalogue and point of sale.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={statusBusy}
              onClick={(e) => {
                e.preventDefault()
                void confirmStatusChange()
              }}
            >
              {statusTarget?.status === 'ACTIVE' ? 'Disable product' : 'Enable product'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}