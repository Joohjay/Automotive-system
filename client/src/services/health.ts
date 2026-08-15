import type { HealthResponse } from '@/types/health'
import { apiRequest } from '@/services/http'

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health')
}
