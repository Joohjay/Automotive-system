import { apiRequest } from '@/services/http'
import type { AdminBranch } from '@/types/admin'

export async function listBranches(): Promise<AdminBranch[]> {
  const res = await apiRequest<{ data: AdminBranch[] }>('/branches')
  return res.data
}

export async function getBranch(id: string): Promise<AdminBranch> {
  const res = await apiRequest<{ data: AdminBranch }>(`/branches/${id}`)
  return res.data
}

export async function createBranch(input: {
  name: string; code: string; address?: string; phone?: string; email?: string
}): Promise<{ id: string }> {
  const res = await apiRequest<{ data: { id: string } }>('/branches', {
    method: 'POST', body: JSON.stringify(input),
  })
  return res.data
}

export async function updateBranch(id: string, input: {
  name?: string; code?: string; address?: string; phone?: string; email?: string; status?: string
}): Promise<void> {
  await apiRequest(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function activateBranch(id: string): Promise<void> {
  await apiRequest(`/branches/${id}/activate`, { method: 'POST' })
}

export async function deactivateBranch(id: string): Promise<void> {
  await apiRequest(`/branches/${id}/deactivate`, { method: 'POST' })
}
