import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type {
  CreditAccount,
  CreditPayment,
  CreditPaymentInput,
  Customer,
  CustomerDetail,
  CustomerInput,
} from '@/types/customer'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listCustomers(query: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Customer>> {
  return apiRequest<Paginated<Customer>>(
    `/customers${toQuery({
      search: query.search,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    })}`,
  )
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  const res = await apiRequest<{ data: CustomerDetail }>(`/customers/${id}`)
  return res.data
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const res = await apiRequest<{ data: Customer }>('/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  const res = await apiRequest<{ data: Customer }>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function setCustomerStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<Customer> {
  const res = await apiRequest<{ data: Customer }>(`/customers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return res.data
}

export async function createCreditPayment(
  customerId: string,
  input: CreditPaymentInput,
): Promise<{ id: string; amount: string; outstandingBalance: string }> {
  const res = await apiRequest<{ data: { id: string; amount: string; outstandingBalance: string } }>(
    `/customers/${customerId}/payments`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return res.data
}

export type { CreditAccount, CreditPayment }
