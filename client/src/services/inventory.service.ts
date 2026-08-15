import { apiRequest } from '@/services/http'
import type { InventorySummary, InventoryTransaction, Paginated, StockRow } from '@/types/inventory'
import type { TransactionType } from '@/types/inventory'

export async function getInventorySummary(): Promise<InventorySummary> {
  const res = await apiRequest<{ data: InventorySummary }>('/inventory/summary')
  return res.data
}

export async function listTransactions(params: {
  productId?: string
  type?: TransactionType
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<InventoryTransaction>> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return apiRequest<Paginated<InventoryTransaction>>(`/inventory/transactions${s ? `?${s}` : ''}`)
}

export async function createAdjustment(input: {
  productId: string
  locationId: string
  newQuantity: number
  reason: string
  note?: string | null
}): Promise<{ productId: string; quantityOnHand: number; adjusted: number }> {
  const res = await apiRequest<{ data: { productId: string; quantityOnHand: number; adjusted: number } }>(
    '/inventory/adjustments',
    { method: 'POST', body: JSON.stringify(input) },
  )
  return res.data
}

export async function listStock(): Promise<StockRow[]> {
  const res = await apiRequest<{ data: StockRow[] }>('/inventory/stock')
  return res.data
}