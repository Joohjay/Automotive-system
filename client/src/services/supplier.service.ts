import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type { Supplier, SupplierInput } from '@/types/supplier'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listSuppliers(query: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Supplier>> {
  return apiRequest<Paginated<Supplier>>(
    `/suppliers${toQuery({
      search: query.search,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    })}`,
  )
}

export async function getSupplier(id: string): Promise<Supplier> {
  const res = await apiRequest<{ data: Supplier }>(`/suppliers/${id}`)
  return res.data
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const res = await apiRequest<{ data: Supplier }>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  const res = await apiRequest<{ data: Supplier }>(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function setSupplierStatus(id: string, status: Supplier['status']): Promise<Supplier> {
  const res = await apiRequest<{ data: Supplier }>(`/suppliers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return res.data
}