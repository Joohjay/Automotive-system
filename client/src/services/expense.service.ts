import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type { Expense, ExpenseCategory, ExpenseInput, ExpenseCategoryInput } from '@/types/expense'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listExpenses(query: {
  search?: string
  categoryId?: string
  paymentMethod?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Expense>> {
  return apiRequest<Paginated<Expense>>(
    `/expenses${toQuery({ search: query.search, categoryId: query.categoryId, paymentMethod: query.paymentMethod, from: query.from, to: query.to, page: query.page, pageSize: query.pageSize })}`,
  )
}

export async function getExpense(id: string): Promise<Expense> {
  const res = await apiRequest<{ data: Expense }>(`/expenses/${id}`)
  return res.data
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const res = await apiRequest<{ data: Expense }>('/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function listExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
  const qs = includeInactive ? '?includeInactive=true' : ''
  const res = await apiRequest<{ data: ExpenseCategory[] }>(`/expenses/categories${qs}`)
  return res.data
}

export async function createExpenseCategory(input: ExpenseCategoryInput): Promise<ExpenseCategory> {
  const res = await apiRequest<{ data: ExpenseCategory }>('/expenses/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function getExpenseSummary(): Promise<{
  monthTotal: number
  yearTotal: number
  byCategory: { categoryId: string; name: string; total: number }[]
}> {
  return apiRequest('/expenses/summary')
}
