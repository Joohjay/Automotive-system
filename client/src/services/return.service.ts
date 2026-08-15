import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type { Return, ReturnDetail, ReturnInput, ReturnStatus } from '@/types/return'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listReturns(query: {
  search?: string
  status?: ReturnStatus
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Return>> {
  return apiRequest<Paginated<Return>>(
    `/returns${toQuery({
      search: query.search,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    })}`,
  )
}

export async function getReturn(id: string): Promise<ReturnDetail> {
  const res = await apiRequest<{ data: ReturnDetail }>(`/returns/${id}`)
  return res.data
}

export async function createReturn(input: ReturnInput): Promise<Return> {
  const res = await apiRequest<{ data: Return }>('/returns', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}
