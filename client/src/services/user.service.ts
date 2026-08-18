import { apiRequest } from '@/services/http'
import type { AdminUser, Role } from '@/types/admin'

export async function listUsers(params: {
  search?: string
  status?: string
  roleId?: string
  branchId?: string
  page?: number
  pageSize?: number
} = {}): Promise<{ data: AdminUser[]; pagination: { total: number; pages: number; page: number; pageSize: number } }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v))
  }
  const s = qs.toString()
  return apiRequest(`/users${s ? `?${s}` : ''}`)
}

export async function getUser(id: string): Promise<AdminUser> {
  const res = await apiRequest<{ data: AdminUser }>(`/users/${id}`)
  return res.data
}

export async function createUser(input: {
  email: string; fullName: string; phone?: string; roleId: string; branchId: string; password: string
}): Promise<{ id: string }> {
  const res = await apiRequest<{ data: { id: string } }>('/users', {
    method: 'POST', body: JSON.stringify(input),
  })
  return res.data
}

export async function updateUser(id: string, input: {
  email?: string; fullName?: string; phone?: string; roleId?: string; branchId?: string; status?: string
}): Promise<void> {
  await apiRequest(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function activateUser(id: string): Promise<void> {
  await apiRequest(`/users/${id}/activate`, { method: 'POST' })
}

export async function deactivateUser(id: string): Promise<void> {
  await apiRequest(`/users/${id}/deactivate`, { method: 'POST' })
}

export async function assignRole(id: string, roleId: string): Promise<void> {
  await apiRequest(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ roleId }) })
}

export async function assignBranch(id: string, branchId: string): Promise<void> {
  await apiRequest(`/users/${id}/branch`, { method: 'PATCH', body: JSON.stringify({ branchId }) })
}

export async function adminResetPassword(id: string, password: string): Promise<void> {
  await apiRequest(`/users/${id}/password-reset`, {
    method: 'POST', body: JSON.stringify({ password }),
  })
}

export async function listRoles(): Promise<Role[]> {
  const res = await apiRequest<{ data: Role[] }>('/reference/roles')
  return res.data
}

export async function listBranchesRef(): Promise<{ id: string; name: string; code: string }[]> {
  const res = await apiRequest<{ data: { id: string; name: string; code: string }[] }>('/reference/branches')
  return res.data
}
