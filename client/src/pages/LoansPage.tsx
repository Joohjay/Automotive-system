import { useCallback, useEffect, useState } from 'react'
import { Plus, Eye, XCircle, FileText } from 'lucide-react'
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
import { listLoans, getLoan, createLoan, closeLoan, recordLoanPayment, getLoanSummary } from '@/services/loan.service'
import type { Loan, LoanDetail, LoanSchedule, LoanInput, LoanPaymentInput } from '@/types/loan'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DEFAULTED', label: 'Defaulted' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const INTEREST_METHODS = [
  { value: 'SIMPLE', label: 'Simple Interest' },
  { value: 'COMPOUND', label: 'Compound Interest' },
  { value: 'FLAT', label: 'Flat Rate' },
]

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CHECK', label: 'Check' },
]

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default'
    case 'CLOSED':
      return 'secondary'
    case 'DEFAULTED':
      return 'destructive'
    case 'CANCELLED':
      return 'destructive'
    default:
      return 'outline'
  }
}

function repaymentBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PAID':
      return 'default'
    case 'PARTIALLY_PAID':
      return 'secondary'
    case 'PENDING':
      return 'outline'
    case 'OVERDUE':
      return 'destructive'
    default:
      return 'outline'
  }
}

const PAGE_SIZE = 15

export function LoansPage() {
  const { settings } = useAuth()
  const currency = settings?.currency || 'USD'

  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; pages: number }>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    pages: 0,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [summary, setSummary] = useState({
    totalPrincipal: 0,
    totalRepaid: 0,
    outstanding: 0,
    activeCount: 0,
  })

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formLender, setFormLender] = useState('')
  const [formReference, setFormReference] = useState('')
  const [formPrincipal, setFormPrincipal] = useState('')
  const [formInterestRate, setFormInterestRate] = useState('')
  const [formInterestMethod, setFormInterestMethod] = useState('SIMPLE')
  const [formDurationMonths, setFormDurationMonths] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formMaturityDate, setFormMaturityDate] = useState('')
  const [formExpectedInterest, setFormExpectedInterest] = useState('')
  const [formTotalRepayment, setFormTotalRepayment] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<LoanDetail | null>(null)

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentSchedule, setPaymentSchedule] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  // Close loan
  const [closingLoanId, setClosingLoanId] = useState<string | null>(null)

  const fetchLoans = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        pageSize: PAGE_SIZE,
      }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter

      const result = await listLoans(params)
      setLoans(result.data)
      setPagination({
        page: result.pagination.page,
        pageSize: result.pagination.pageSize,
        total: result.pagination.total,
        pages: result.pagination.pages,
      })
    } catch {
      toast.error('Failed to load loans')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    fetchLoans(1)
  }, [fetchLoans])

  useEffect(() => {
    getLoanSummary().then((s) => {
      setSummary({
        totalPrincipal: Number(s.totalPrincipal ?? 0),
        totalRepaid: Number(s.totalRepaid ?? 0),
        outstanding: Number(s.outstanding ?? 0),
        activeCount: Number(s.totalLoans ?? 0),
      })
    }).catch(() => {})
  }, [])

  const resetCreateForm = () => {
    setFormLender('')
    setFormReference('')
    setFormPrincipal('')
    setFormInterestRate('')
    setFormInterestMethod('SIMPLE')
    setFormDurationMonths('')
    setFormStartDate('')
    setFormMaturityDate('')
    setFormExpectedInterest('')
    setFormTotalRepayment('')
    setFormNotes('')
  }

  const handleCreate = async () => {
    if (!formLender.trim()) {
      toast.error('Please enter a lender name')
      return
    }
    const principal = parseFloat(formPrincipal)
    if (isNaN(principal) || principal <= 0) {
      toast.error('Please enter a valid principal amount')
      return
    }
    const interestRate = parseFloat(formInterestRate)
    if (isNaN(interestRate) || interestRate < 0) {
      toast.error('Please enter a valid interest rate')
      return
    }
    const durationMonths = parseInt(formDurationMonths, 10)
    if (isNaN(durationMonths) || durationMonths <= 0) {
      toast.error('Please enter a valid duration')
      return
    }

    setSaving(true)
    try {
      const input: LoanInput = {
        lender: formLender.trim(),
        reference: formReference.trim() || undefined,
        principalAmount: principal,
        interestRate,
        interestMethod: formInterestMethod as any,
        durationMonths,
        startDate: formStartDate || new Date().toISOString().split('T')[0],
        maturityDate: formMaturityDate || undefined,
        totalExpectedInterest: formExpectedInterest ? parseFloat(formExpectedInterest) : undefined,
        totalRepayment: formTotalRepayment ? parseFloat(formTotalRepayment) : undefined,
        notes: formNotes.trim() || undefined,
      }
      await createLoan(input)
      toast.success('Loan created')
      setCreateOpen(false)
      resetCreateForm()
      fetchLoans(pagination.page)
    } catch {
      toast.error('Failed to create loan')
    } finally {
      setSaving(false)
    }
  }

  const handleViewDetail = async (loanId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const data = await getLoan(loanId)
      setDetail(data)
    } catch {
      toast.error('Failed to load loan details')
    } finally {
      setDetailLoading(false)
    }
  }

  const resetPaymentForm = () => {
    setPaymentAmount('')
    setPaymentMethod('CASH')
    setPaymentSchedule('')
    setPaymentReference('')
  }

  const handleRecordPayment = async () => {
    if (!detail) return
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    setPaymentSaving(true)
    try {
      const input: LoanPaymentInput = {
        amount,
        method: paymentMethod,
        scheduleId: paymentSchedule || undefined,
        reference: paymentReference.trim() || undefined,
      }
      await recordLoanPayment(detail.id, input)
      toast.success('Payment recorded')
      setPaymentOpen(false)
      resetPaymentForm()
      const updated = await getLoan(detail.id)
      setDetail(updated)
      fetchLoans(pagination.page)
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setPaymentSaving(false)
    }
  }

  const handleCloseLoan = async (loanId: string) => {
    setClosingLoanId(loanId)
    try {
      await closeLoan(loanId)
      toast.success('Loan closed')
      fetchLoans(pagination.page)
      if (detail && detail.id === loanId) {
        const updated = await getLoan(loanId)
        setDetail(updated)
      }
    } catch {
      toast.error('Failed to close loan')
    } finally {
      setClosingLoanId(null)
    }
  }

  const canCloseLoan = (loan: Loan) => {
    return loan.status === 'ACTIVE'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        description="Track borrowed funds, repayment schedules and payments."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Loan
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Principal</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{formatMoney(summary.totalPrincipal, currency)}</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Repaid</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{formatMoney(summary.totalRepaid, currency)}</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{formatMoney(summary.outstanding, currency)}</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Active Loans</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-2 text-3xl font-bold">{summary.activeCount}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium">Search</label>
          <Input
            placeholder="Search by lender or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLoans(1)}
          />
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map((sf) => (
              <option key={sf.value} value={sf.value}>
                {sf.label}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" onClick={() => fetchLoans(1)}>
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
      ) : loans.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No loans found"
          description="Add your first loan to start tracking borrowed funds."
        />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Lender</th>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-right font-medium">Principal</th>
                  <th className="px-4 py-3 text-right font-medium">Interest Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Duration</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Payments</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-b last:border-0 hover:bg-muted/25">
                    <td className="px-4 py-3 font-medium">{loan.lender}</td>
                    <td className="px-4 py-3 text-muted-foreground">{loan.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(loan.principalAmount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">{loan.interestRate}%</td>
                    <td className="px-4 py-3 text-right">{loan.durationMonths} mo</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={statusBadgeVariant(loan.status)}>
                        {loan.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">{loan._count?.payments ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(loan.id)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                        {canCloseLoan(loan) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCloseLoan(loan.id)}
                            disabled={closingLoanId === loan.id}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Close
                          </Button>
                        )}
                      </div>
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
            Page {pagination.page} of {pagination.pages} ({pagination.total} loans)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchLoans(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchLoans(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ============ CREATE LOAN DIALOG ============ */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm() }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Lender *</label>
              <Input
                placeholder="e.g. ABC Bank"
                value={formLender}
                onChange={(e) => setFormLender(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Reference</label>
              <Input
                placeholder="e.g. Loan Agreement #001"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Principal *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formPrincipal}
                  onChange={(e) => setFormPrincipal(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Interest Rate (%) *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formInterestRate}
                  onChange={(e) => setFormInterestRate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Interest Method</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formInterestMethod}
                  onChange={(e) => setFormInterestMethod(e.target.value)}
                >
                  {INTEREST_METHODS.map((im) => (
                    <option key={im.value} value={im.value}>
                      {im.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Duration (months) *</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 12"
                  value={formDurationMonths}
                  onChange={(e) => setFormDurationMonths(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Maturity Date</label>
                <Input
                  type="date"
                  value={formMaturityDate}
                  onChange={(e) => setFormMaturityDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Expected Interest</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formExpectedInterest}
                  onChange={(e) => setFormExpectedInterest(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Total Repayment</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formTotalRepayment}
                  onChange={(e) => setFormTotalRepayment(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Additional notes..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : 'Create Loan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DETAIL DIALOG ============ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Loan Info */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Lender</p>
                  <p className="text-sm font-semibold">{detail.lender}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Reference</p>
                  <p className="text-sm">{detail.reference ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <Badge variant={statusBadgeVariant(detail.status)}>{detail.status}</Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Principal</p>
                  <p className="text-sm font-semibold">{formatMoney(detail.principalAmount, currency)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Interest Rate</p>
                  <p className="text-sm">{detail.interestRate}% ({detail.interestMethod})</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Duration</p>
                  <p className="text-sm">{detail.durationMonths} months</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Start Date</p>
                  <p className="text-sm">{formatDate(detail.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Maturity Date</p>
                  <p className="text-sm">{detail.maturityDate ? formatDate(detail.maturityDate) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Repayment</p>
                  <p className="text-sm font-semibold">
                    {detail.totalRepayment != null ? formatMoney(detail.totalRepayment, currency) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Paid</p>
                  <p className="text-sm font-semibold">
                    {formatMoney(detail.payments.reduce((sum: number, p) => sum + Number(p.amount), 0), currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
                  <p className="text-sm font-semibold">
                    {detail.totalRepayment != null
                      ? formatMoney(Math.max(0, Number(detail.totalRepayment) - detail.payments.reduce((sum: number, p) => sum + Number(p.amount), 0)), currency)
                      : '—'}
                  </p>
                </div>
                {detail.notes && (
                  <div className="col-span-full">
                    <p className="text-xs font-medium text-muted-foreground">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>
                  </div>
                )}
              </div>

              {/* Schedule Table */}
              {detail.schedules && detail.schedules.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Repayment Schedule</h4>
                  <div className="rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">#</th>
                          <th className="px-3 py-2 text-left font-medium">Due Date</th>
                          <th className="px-3 py-2 text-right font-medium">Principal</th>
                          <th className="px-3 py-2 text-right font-medium">Interest</th>
                          <th className="px-3 py-2 text-right font-medium">Total Due</th>
                          <th className="px-3 py-2 text-right font-medium">Paid</th>
                          <th className="px-3 py-2 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.schedules.map((s: LoanSchedule, idx: number) => (
                          <tr key={s.id ?? idx} className="border-b last:border-0">
                            <td className="px-3 py-2">{s.installmentNo ?? idx + 1}</td>
                            <td className="px-3 py-2">{formatDate(s.dueDate)}</td>
                            <td className="px-3 py-2 text-right">{formatMoney(s.principalAmount, currency)}</td>
                            <td className="px-3 py-2 text-right">{formatMoney(s.interestAmount, currency)}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatMoney(s.totalDue, currency)}
                            </td>
                            <td className="px-3 py-2 text-right">{formatMoney(s.amountPaid ?? 0, currency)}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={repaymentBadgeVariant(s.status)}>
                                {s.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payments Table */}
              {detail.payments && detail.payments.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Payments</h4>
                  <div className="rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                          <th className="px-3 py-2 text-left font-medium">Method</th>
                          <th className="px-3 py-2 text-left font-medium">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.payments.map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-3 py-2">{formatDate(p.paymentDate)}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatMoney(p.amount, currency)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline">{p.method?.replace('_', ' ')}</Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{p.reference ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => {
                    setPaymentOpen(true)
                    resetPaymentForm()
                  }}
                >
                  Record Payment
                </Button>
                {canCloseLoan(detail) && (
                  <Button
                    variant="destructive"
                    onClick={() => handleCloseLoan(detail.id)}
                    disabled={closingLoanId === detail.id}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {closingLoanId === detail.id ? 'Closing...' : 'Close Loan'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No details available.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ PAYMENT DIALOG ============ */}
      <Dialog open={paymentOpen} onOpenChange={(open) => { setPaymentOpen(open); if (!open) resetPaymentForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Amount *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Method</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
            {detail && detail.schedules && detail.schedules.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Apply to Schedule (optional)</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={paymentSchedule}
                  onChange={(e) => setPaymentSchedule(e.target.value)}
                >
                  <option value="">General payment</option>
                  {detail.schedules
                    .filter((s: LoanSchedule) => s.status !== 'PAID')
                    .map((s: LoanSchedule) => (
                      <option key={s.id} value={s.id}>
                        Installment #{s.installmentNo ?? '-'} — Due {formatDate(s.dueDate)} — {formatMoney(s.totalDue, currency)}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Reference</label>
              <Input
                placeholder="e.g. Receipt #"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={paymentSaving}>
              {paymentSaving ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
