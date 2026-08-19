import { useCallback, useEffect, useState } from 'react'
import { Plus, Eye, XCircle, FileText } from 'lucide-react'
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
  const currency = settings?.currency ?? 'TZS'

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
  const [closeTarget, setCloseTarget] = useState<Loan | LoanDetail | null>(null)
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

  const confirmCloseLoan = async () => {
    if (!closeTarget || closingLoanId) return
    const loanId = closeTarget.id
    setClosingLoanId(loanId)
    try {
      await closeLoan(loanId)
      toast.success('Loan closed')
      setCloseTarget(null)
      fetchLoans(pagination.page)
      if (detail && detail.id === loanId) {
        const updated = await getLoan(loanId)
        setDetail(updated)
      }
    } catch (err) {
      toast.error(toastErrorMessage(err))
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
        <div className="relative min-w-52 flex-1">
          <Input
            placeholder="Search by lender or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLoans(1)}
          />
        </div>
        <div className="min-w-[140px]">
          <Label>Status</Label>
          <Select value={statusFilter || undefined} onValueChange={(v) => setStatusFilter(v ?? '')}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((sf) => (
                <SelectItem key={sf.value} value={sf.value}>
                  {sf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest rate</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">{loan.lender}</TableCell>
                  <TableCell className="text-muted-foreground">{loan.reference ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(loan.principalAmount, currency)}
                  </TableCell>
                  <TableCell className="text-right">{loan.interestRate}%</TableCell>
                  <TableCell className="text-right">{loan.durationMonths} mo</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(loan.status)}>
                      {loan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{loan._count?.payments ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
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
                          onClick={() => setCloseTarget(loan)}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Close
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={pagination.page} pages={pagination.pages} onPageChange={fetchLoans} />

      {/* ============ CREATE LOAN DIALOG ============ */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm() }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lender *</Label>
              <Input
                className="mt-1"
                placeholder="e.g. ABC Bank"
                value={formLender}
                onChange={(e) => setFormLender(e.target.value)}
              />
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Loan Agreement #001"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Principal *</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formPrincipal}
                  onChange={(e) => setFormPrincipal(e.target.value)}
                />
              </div>
              <div>
                <Label>Interest rate (%) *</Label>
                <Input
                  className="mt-1"
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
                <Label>Interest method</Label>
                <Select value={formInterestMethod} onValueChange={setFormInterestMethod}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEREST_METHODS.map((im) => (
                      <SelectItem key={im.value} value={im.value}>
                        {im.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (months) *</Label>
                <Input
                  className="mt-1"
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
                <Label>Start date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Maturity date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={formMaturityDate}
                  onChange={(e) => setFormMaturityDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expected interest</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formExpectedInterest}
                  onChange={(e) => setFormExpectedInterest(e.target.value)}
                />
              </div>
              <div>
                <Label>Total repayment</Label>
                <Input
                  className="mt-1"
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
              <Label>Notes</Label>
              <Textarea
                className="mt-1"
                placeholder="Additional notes…"
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
                    onClick={() => setCloseTarget(detail)}
                    disabled={closingLoanId === detail.id}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {closingLoanId === detail.id ? 'Closing…' : 'Close Loan'}
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
              <Label>Amount *</Label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
            {detail && detail.schedules && detail.schedules.length > 0 && (
              <div>
                <Label>Apply to schedule (optional)</Label>
                <Select value={paymentSchedule || undefined} onValueChange={(v) => setPaymentSchedule(v === '__general' ? '' : (v ?? ''))}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="General payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__general">General payment</SelectItem>
                    {detail.schedules
                      .filter((s: LoanSchedule) => s.status !== 'PAID')
                      .map((s: LoanSchedule) => (
                        <SelectItem key={s.id} value={s.id}>
                          Installment #{s.installmentNo ?? '-'} — Due {formatDate(s.dueDate)} — {formatMoney(s.totalDue, currency)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Reference</Label>
              <Input
                className="mt-1"
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
              {paymentSaving ? 'Saving…' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={closeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !closingLoanId) setCloseTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close loan?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{closeTarget?.lender}</strong>
              {closeTarget?.reference ? <> ({closeTarget.reference})</> : null} will be marked as
              closed and can no longer receive payments. Outstanding installments remain recorded
              for reference. This can be reviewed later but is a significant change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep open</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={closingLoanId !== null}
              onClick={(e) => {
                e.preventDefault()
                void confirmCloseLoan()
              }}
            >
              {closingLoanId ? 'Closing…' : 'Close loan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
