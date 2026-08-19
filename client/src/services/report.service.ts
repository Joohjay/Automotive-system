import { apiRequest } from '@/services/http'

function toQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, v)
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export interface SalesReport {
  period: { from: string; to: string }
  totalSales: number
  totalRevenue: string
  totalDiscounts: string
  byPaymentMethod: { method: string; count: number; total: string }[]
  topProducts: { productId: string; name: string; quantity: number; revenue: string }[]
  dailySales: { date: string; count: number; total: string }[]
}

export interface InventoryReport {
  totalProducts: number
  totalUnits: number
  lowStockCount: number
  outOfStockCount: number
  byCategory: { categoryId: string; name: string; productCount: number; totalUnits: number }[]
}

export interface ExpenseReport {
  period: { from: string; to: string }
  totalExpenses: string
  byCategory: { categoryId: string; name: string; total: string }[]
  byPaymentMethod: { method: string; count: number; total: string }[]
}

export interface ProfitLossReport {
  period: { from: string; to: string }
  revenue: string
  cogs: string
  expenses: string
  grossProfit: string
  netProfit: string
  daily: { date: string; revenue: string; expenses: string }[]
  byCategory: { categoryId: string; name: string; total: string }[]
}

export async function getSalesReport(query: { from?: string; to?: string } = {}): Promise<SalesReport> {
  const res = await apiRequest<{ data: SalesReport }>(`/reports/sales${toQuery(query)}`)
  return res.data
}

export async function getInventoryReport(): Promise<InventoryReport> {
  const res = await apiRequest<{ data: InventoryReport }>('/reports/inventory')
  return res.data
}

export async function getExpenseReport(query: { from?: string; to?: string } = {}): Promise<ExpenseReport> {
  const res = await apiRequest<{ data: ExpenseReport }>(`/reports/expenses${toQuery(query)}`)
  return res.data
}

export async function getProfitLoss(query: { from?: string; to?: string } = {}): Promise<ProfitLossReport> {
  const res = await apiRequest<{ data: ProfitLossReport }>(`/reports/pnl${toQuery(query)}`)
  return res.data
}