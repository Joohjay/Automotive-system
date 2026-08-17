import { useCallback, useEffect, useState } from 'react'
import { Plus, Receipt } from 'lucide-react'
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
  const currency = settings?.currency || 'USD'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
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
    getExpenseSummary().then((s) => {
      setSummary({
        monthTotal: Number(s.monthTotal ?? 0),
        yearTotal: Number(s.yearTotal ?? 0),
      })
    }).catch(() => {})
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
    } catch {
      toast.error('Failed to create category')
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
    } catch {
      toast.error('Failed to record expense')
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
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total This Month</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{formatMoney(summary.monthTotal, currency)}</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total This Year</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{formatMoney(summary.yearTotal, currency)}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium">Search</label>
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-sm font-medium">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-sm font-medium">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          Filter
        </Button>
      </div>

      {/* Table */}
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
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Payment Method</th>
                  <th className="px-4 py-3 text-left font-medium">Created by</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b last:border-0 hover:bg-muted/25">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(expense.expenseDate)}</td>
                    <td className="px-4 py-3 max-w-[300px] truncate">{expense.description}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{expense.category?.name ?? '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(expense.amount, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {expense.paymentMethod?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {expense.createdBy?.fullName ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages} ({pagination.total} expenses)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchExpenses(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchExpenses(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Category */}
            <div>
              <label className="mb-1 block text-sm font-medium">Category *</label>
              {!showNewCategory ? (
                <div className="flex gap-2">
                  <select
                    className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewCategory(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
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
                      {savingCategory ? 'Saving...' : 'Save Category'}
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

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium">Description *</label>
              <Input
                placeholder="e.g. Office supplies purchase"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1 block text-sm font-medium">Amount *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Method</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="mb-1 block text-sm font-medium">Reference (optional)</label>
              <Input
                placeholder="e.g. Receipt #12345"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Additional notes..."
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
              {saving ? 'Saving...' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
