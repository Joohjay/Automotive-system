import { useCallback, useEffect, useState } from 'react'
import { Building2, Plus, Search } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { toastErrorMessage } from '@/lib/errors'
import { listSuppliers, setSupplierStatus } from '@/services/supplier.service'
import type { Supplier } from '@/types/supplier'
import { SupplierFormDialog } from '@/components/suppliers/SupplierFormDialog'

const PAGE_SIZE = 10

export function SuppliersPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('supplier.manage')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [statusTarget, setStatusTarget] = useState<Supplier | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSuppliers({
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setSuppliers(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  async function confirmStatusChange() {
    if (!statusTarget || statusBusy) return
    const s = statusTarget
    setStatusBusy(true)
    try {
      await setSupplierStatus(s.id, s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      toast.success(s.status === 'ACTIVE' ? 'Supplier deactivated' : 'Supplier activated')
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
        title="Suppliers"
        description={`${total} vendor${total === 1 ? '' : 's'} on record`}
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus /> Add supplier
            </Button>
          ) : null
        }
      />

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder="Search by name, contact or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No suppliers yet"
            description="Add your first vendor to start creating purchase orders."
            action={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setDialogOpen(true)
                  }}
                >
                  <Plus /> Add supplier
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tax no.</TableHead>
                <TableHead>Purchases</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contactPerson ?? '—'}</TableCell>
                  <TableCell>{s.phone ?? '—'}</TableCell>
                  <TableCell>{s.email ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{s.taxNumber ?? '—'}</TableCell>
                  <TableCell>{s._count?.purchases ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(s)
                            setDialogOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setStatusTarget(s)}>
                          {s.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination page={page} pages={pages} onPageChange={setPage} />

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editing}
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
              {statusTarget?.status === 'ACTIVE' ? 'Disable supplier?' : 'Enable supplier?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.status === 'ACTIVE' ? (
                <>
                  <strong>{statusTarget.name}</strong> will no longer be available for new purchase
                  orders. Existing purchase history is preserved and the supplier can be re-enabled
                  later.
                </>
              ) : (
                <>
                  <strong>{statusTarget?.name}</strong> will become available for purchase orders
                  again.
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
              {statusTarget?.status === 'ACTIVE' ? 'Disable supplier' : 'Enable supplier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}