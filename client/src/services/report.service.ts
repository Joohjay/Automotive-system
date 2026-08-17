import { apiRequest } from '@/services/http'

function toQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, v)
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function getSalesReport(query: { from?: string; to?: string } = {}): Promise<unknown> {
  return apiRequest<unknown>(`/reports/sales${toQuery(query)}`)
}

export async function getInventoryReport(): Promise<unknown> {
  return apiRequest<unknown>('/reports/inventory')
}

export async function getExpenseReport(query: { from?: string; to?: string } = {}): Promise<unknown> {
  return apiRequest<unknown>(`/reports/expenses${toQuery(query)}`)
}

export async function getProfitLoss(query: { from?: string; to?: string } = {}): Promise<unknown> {
  return apiRequest<unknown>(`/reports/pnl${toQuery(query)}`)
}
