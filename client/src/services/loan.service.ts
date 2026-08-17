import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type { Loan, LoanDetail, LoanInput, LoanPaymentInput } from '@/types/loan'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listLoans(query: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Loan>> {
  return apiRequest<Paginated<Loan>>(
    `/loans${toQuery({ search: query.search, status: query.status, page: query.page, pageSize: query.pageSize })}`,
  )
}

export async function getLoan(id: string): Promise<LoanDetail> {
  const res = await apiRequest<{ data: LoanDetail }>(`/loans/${id}`)
  return res.data
}

export async function createLoan(input: LoanInput): Promise<Loan> {
  const res = await apiRequest<{ data: Loan }>('/loans', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function closeLoan(id: string): Promise<Loan> {
  const res = await apiRequest<{ data: Loan }>(`/loans/${id}/close`, { method: 'POST' })
  return res.data
}

export async function getLoanSummary(): Promise<{
  totalPrincipal: number
  totalRepayment: number
  totalRepaid: number
  outstanding: number
  totalLoans: number
  countByStatus: Record<string, number>
}> {
  return apiRequest('/loans/summary')
}

export async function recordLoanPayment(id: string, input: LoanPaymentInput): Promise<unknown> {
  const res = await apiRequest<{ data: unknown }>(`/loans/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function generateSchedule(id: string, installments: { installmentNo: number; dueDate: string; principalAmount: number; interestAmount: number; totalDue: number }[]): Promise<{ count: number }> {
  const res = await apiRequest<{ data: { count: number } }>(`/loans/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ installments }),
  })
  return res.data
}
