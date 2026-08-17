import { apiRequest } from '@/services/http'
import type { Notification } from '@/types/notification'

export async function listNotifications(query: {
  status?: string
  page?: number
  pageSize?: number
} = {}): Promise<{ data: Notification[]; pagination: { page: number; pageSize: number; total: number; pages: number }; unreadCount: number }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return apiRequest(`/notifications${s ? `?${s}` : ''}`)
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest('/notifications/read-all', { method: 'POST' })
}
