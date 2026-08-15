import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type { Sale, SaleDetail, SaleInput, SaleStatus } from '@/types/sale'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listSales(query: {
  search?: string
  status?: SaleStatus
  customerId?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Sale>> {
  return apiRequest<Paginated<Sale>>(
    `/sales${toQuery({
      search: query.search,
      status: query.status,
      customerId: query.customerId,
      page: query.page,
      pageSize: query.pageSize,
    })}`,
  )
}

export async function getSale(id: string): Promise<SaleDetail> {
  const res = await apiRequest<{ data: SaleDetail }>(`/sales/${id}`)
  return res.data
}

export async function createSale(input: SaleInput): Promise<Sale> {
  const res = await apiRequest<{ data: Sale }>('/sales', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function voidSale(id: string, reason?: string): Promise<{ id: string; status: SaleStatus }> {
  const res = await apiRequest<{ data: { id: string; status: SaleStatus } }>(
    `/sales/${id}/void`,
    { method: 'POST', body: JSON.stringify({ reason: reason ?? null }) },
  )
  return res.data
}
