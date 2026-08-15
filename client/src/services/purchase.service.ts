import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type {
  Purchase,
  PurchaseDetail,
  PurchaseInput,
  PurchaseStatus,
} from '@/types/purchase'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listPurchases(query: {
  search?: string
  status?: PurchaseStatus
  supplierId?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Purchase>> {
  return apiRequest<Paginated<Purchase>>(
    `/purchases${toQuery({
      search: query.search,
      status: query.status,
      supplierId: query.supplierId,
      page: query.page,
      pageSize: query.pageSize,
    })}`,
  )
}

export async function getPurchase(id: string): Promise<PurchaseDetail> {
  const res = await apiRequest<{ data: PurchaseDetail }>(`/purchases/${id}`)
  return res.data
}

export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  const res = await apiRequest<{ data: Purchase }>('/purchases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function receivePurchase(
  id: string,
  input: { locationId: string; items: { itemId: string; quantity: number }[] },
): Promise<{ id: string; status: PurchaseStatus }> {
  const res = await apiRequest<{ data: { id: string; status: PurchaseStatus } }>(
    `/purchases/${id}/receive`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return res.data
}

export async function cancelPurchase(id: string): Promise<{ id: string; status: PurchaseStatus }> {
  const res = await apiRequest<{ data: { id: string; status: PurchaseStatus } }>(
    `/purchases/${id}/cancel`,
    { method: 'POST' },
  )
  return res.data
}