import { apiRequest } from '@/services/http'

export interface MfaStatusResponse {
  mfaEnabled: boolean
}

export interface MfaSetupResponse {
  uri: string
  secret: string
}

export async function mfaStatus(): Promise<MfaStatusResponse> {
  return apiRequest<MfaStatusResponse>('/auth/mfa/status')
}

export async function mfaSetup(password: string): Promise<MfaSetupResponse> {
  return apiRequest<MfaSetupResponse>('/auth/mfa/setup', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export async function mfaEnable(token: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function mfaDisable(token: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function mfaVerify(token: string): Promise<{ mustChangePassword: boolean; user: unknown; permissions: string[]; settings: unknown }> {
  return apiRequest('/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}
