import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatMoney } from '@/lib/format'
import { getCustomer, listCustomers, setCustomerStatus } from '@/services/customer.service'
import type { Customer, CustomerDetail } from '@/types/customer'
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog'
import { CreditPaymentDialog } from '@/components/customers/CreditPaymentDialog'

const PAGE_SIZE = 10

export function CustomersPage() {
  const { hasPermission, settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const canManage = hasPermission('customer.manage')
  const canPay = hasPermission('credit.payment')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [paying, setPaying] = useState<Customer | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCustomers({
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setCustomers(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load customers')
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

  async function openDetail(customer: Customer) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await getCustomer(customer.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load customer.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function toggleStatus(customer: Customer) {
    setToggling(customer.id)
    try {
      const next = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await setCustomerStatus(customer.id, next)
      toast.success(`Customer marked ${next.toLowerCase()}`)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${total} customer${total === 1 ? '' : 's'} on record`}
        actions={
          canManage ? (
            <Button onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}>
              <Plus /> Add customer
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers"
            description="Add customers to enable credit sales and track their accounts."
            action={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus /> Add customer
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Credit balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const balance = c.creditAccount?.outstandingBalance ?? '0'
                const hasBalance = c.creditEligible && Number(balance) > 0
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button className="text-left font-medium hover:underline" onClick={() => void openDetail(c)}>
                        {c.name}
                      </button>
                      <span className="text-muted-foreground block text-xs">
                        {c.customerType === 'WHOLESALE' ? 'Wholesale' : 'Retail'}
                      </span>
                    </TableCell>
                    <TableCell>{c.customerType === 'WHOLESALE' ? 'Wholesale' : 'Retail'}</TableCell>
                    <TableCell>{c.phone ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {c.creditEligible ? (
                        <Badge variant={hasBalance ? 'warning' : 'secondary'}>
                          {formatMoney(balance, currency)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => void openDetail(c)}>
                          View
                        </Button>
                        {canPay && c.creditEligible && hasBalance ? (
                          <Button variant="ghost" size="sm" onClick={() => setPaying(c)}>
                            Receive payment
                          </Button>
                        ) : null}
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={toggling === c.id}
                            onClick={() => void toggleStatus(c)}
                          >
                            {c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination page={page} pages={pages} onPageChange={setPage} />

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSaved={() => void load()}
      />

      <CreditPaymentDialog
        customer={paying}
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null)
        }}
        onDone={() => void load()}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{detail?.name ?? 'Customer'}</DialogTitle>
            <DialogDescription>
              {detail?.customerType === 'WHOLESALE' ? 'Wholesale' : 'Retail'} · {detail?.phone ?? 'no phone'}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !detail ? null : (
            <div className="space-y-4">
              {detail.creditAccount ? (
                <div className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Outstanding balance</span>
                    <span className="font-semibold">
                      {formatMoney(detail.creditAccount.outstandingBalance, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Credit limit</span>
                    <span>
                      {Number(detail.creditAccount.creditLimit) > 0
                        ? formatMoney(detail.creditAccount.creditLimit, currency)
                        : 'Unlimited'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <Badge variant={detail.creditAccount.status === 'OPEN' ? 'success' : 'warning'}>
                      {detail.creditAccount.status}
                    </Badge>
                  </div>
                  {detail.creditAccount.creditPayments.length > 0 ? (
                    <div className="mt-2 border-t pt-2">
                      <p className="text-muted-foreground mb-1 text-xs font-medium">Recent payments</p>
                      {detail.creditAccount.creditPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-0.5 text-xs">
                          <span>{formatDate(p.paidAt)}</span>
                          <span className="font-medium">{formatMoney(p.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No credit account.</p>
              )}

              {detail.sales && detail.sales.length > 0 ? (
                <div className="rounded-lg border px-3 py-2 text-sm">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Recent sales</p>
                  {detail.sales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-0.5">
                      <span className="font-mono text-xs">{s.receiptNumber}</span>
                      <span>{formatMoney(s.total, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {canManage ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(detail)
                    setFormOpen(true)
                  }}
                >
                  Edit customer
                </Button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
