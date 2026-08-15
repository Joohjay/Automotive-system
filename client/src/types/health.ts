export interface HealthResponse {
  status: string
  service: string
  database: 'up' | 'down'
  timestamp: string
  uptime: number
}
