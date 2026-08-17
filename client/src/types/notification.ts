export type NotificationType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'LOAN_REMINDER' | 'LOAN_OVERDUE' | 'CREDIT_WARNING' | 'OTHER'
export type NotificationStatus = 'UNREAD' | 'READ'

export interface Notification {
  id: string
  userId: string
  branchId: string | null
  type: NotificationType
  title: string
  message: string | null
  referenceType: string | null
  referenceId: string | null
  status: NotificationStatus
  readAt: string | null
  createdAt: string
}
