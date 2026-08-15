import { apiRequest } from '@/services/http'
import type { AuthResponse, MeResponse } from '@/types/auth'

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me')
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
}