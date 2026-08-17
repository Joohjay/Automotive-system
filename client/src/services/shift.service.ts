import { apiRequest } from '@/services/http'
import type { Paginated } from '@/types/product'
import type { Shift, ShiftSummary, OpenShiftInput, CloseShiftInput } from '@/types/shift'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listShifts(query: {
  status?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paginated<Shift>> {
  return apiRequest<Paginated<Shift>>(
    `/shifts${toQuery({ status: query.status, page: query.page, pageSize: query.pageSize })}`,
  )
}

export async function getShift(id: string): Promise<Shift> {
  const res = await apiRequest<{ data: Shift }>(`/shifts/${id}`)
  return res.data
}

export async function openShift(input: OpenShiftInput): Promise<Shift> {
  const res = await apiRequest<{ data: Shift }>('/shifts/open', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function closeShift(id: string, input: CloseShiftInput): Promise<Shift> {
  const res = await apiRequest<{ data: Shift }>(`/shifts/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function getShiftSummary(): Promise<ShiftSummary> {
  return apiRequest<ShiftSummary>('/shifts/summary')
}
