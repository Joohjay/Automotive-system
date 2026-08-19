import { useCallback, useEffect, useState } from 'react'
import { Plus, Receipt, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { toastErrorMessage } from '@/lib/errors'
import { formatMoney, formatDate } from '@/lib/format'
import { listExpenses, createExpense, listExpenseCategories, createExpenseCategory, getExpenseSummary } from '@/services/expense.service'
import type { Expense, ExpenseCategory, ExpenseInput, ExpensePaymentMethod } from '@/types/expense'

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CHECK', label: 'Check' },
]

const PAGE_SIZE = 15

export function ExpensesPage() {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; pages: number }>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    pages: 0,
  })

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [summary, setSummary] = useState({ monthTotal: 0, yearTotal: 0 })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formCategory, setFormCategory] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formPaymentMethod, setFormPaymentMethod] = useState('CASH')
  const [formReference, setFormReference] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await listExpenseCategories()
      setCategories(cats)
    } catch {
      // silent
    }
  }, [])

  const fetchExpenses = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        pageSize: PAGE_SIZE,
      }
      if (search) params.search = search
      if (categoryFilter) params.categoryId = categoryFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo

      const result = await listExpenses(params)
      setExpenses(result.data)
      setPagination({
        page: result.pagination.page,
        pageSize: result.pagination.pageSize,
        total: result.pagination.total,
        pages: result.pagination.pages,
      })
    } catch {
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchExpenses(1)
  }, [fetchExpenses])

  useEffect(() => {
    setLoadingSummary(true)
    getExpenseSummary().then((s) => {
      setSummary({
        monthTotal: Number(s.monthTotal ?? 0),
        yearTotal: Number(s.yearTotal ?? 0),
      })
    }).catch(() => {}).finally(() => setLoadingSummary(false))
  }, [])

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setSavingCategory(true)
    try {
      const cat = await createExpenseCategory({ name: newCategoryName.trim() })
      setCategories((prev) => [...prev, cat])
      setFormCategory(cat.id)
      setNewCategoryName('')
      setShowNewCategory(false)
      toast.success('Category created')
    } catch (err) {
      toast.error(toastErrorMessage(err))
    } finally {
      setSavingCategory(false)
    }
  }

  const handleSubmit = async () => {
    if (!formCategory) {
      toast.error('Please select a category')
      return
    }
    if (!formDescription.trim()) {
      toast.error('Please enter a description')
      return
    }
    const amount = parseFloat(formAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSaving(true)
    try {
      const input: ExpenseInput = {
        categoryId: formCategory,
        description: formDescription.trim(),
        amount,
        paymentMethod: formPaymentMethod as ExpensePaymentMethod,
        reference: formReference.trim() || undefined,
        note: formNotes.trim() || undefined,
        expenseDate: new Date().toISOString(),
      }
      await createExpense(input)
      toast.success('Expense recorded')
      setDialogOpen(false)
      resetForm()
      fetchExpenses(pagination.page)
    } catch (err) {
      toast.error(toastErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormCategory('')
    setFormDescription('')
    setFormAmount('')
    setFormPaymentMethod('CASH')
    setFormReference('')
    setFormNotes('')
    setShowNewCategory(false)
    setNewCategoryName('')
  }

  const handleSearch = () => {
    fetchExpenses(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track operational costs and expense categories."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> Add Expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total This Month</p>
          {loadingSummary ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{formatMoney(summary.monthTotal, currency)}</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total This Year</p>
          {loadingSummary ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{formatMoney(summary.yearTotal, currency)}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className="min-w-[160px]">
          <Label>Category</Label>
          <Select value={categoryFilter || undefined} onValueChange={(v) => setCategoryFilter(v ?? '')}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Label>From</Label>
          <Input className="mt-1" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <Label>To</Label>
          <Input className="mt-1" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          Filter
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses found"
          description="Record your first expense to start tracking costs."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment method</TableHead>
                <TableHead>Created by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(expense.expenseDate)}</TableCell>
                  <TableCell className="max-w-72 truncate">{expense.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{expense.category?.name ?? '—'}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(expense.amount, currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {expense.paymentMethod?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {expense.createdBy?.fullName ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={pagination.page} pages={pagination.pages} onPageChange={fetchExpenses} />

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              {!showNewCategory ? (
                <div className="mt-1 flex gap-2">
                  <div className="flex-1">
                    <Select value={formCategory || undefined} onValueChange={(v) => setFormCategory(v ?? '')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category…" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Create a new category"
                    onClick={() => setShowNewCategory(true)}
                  >
                    <Plus />
                  </Button>
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <Input
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={savingCategory || !newCategoryName.trim()}
                    >
                      {savingCategory ? 'Saving…' : 'Save Category'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNewCategory(false)
                        setNewCategoryName('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Description *</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Office supplies purchase"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div>
              <Label>Amount *</Label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>
                      {pm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference (optional)</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Receipt #12345"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                className="mt-1"
                placeholder="Additional notes…"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}