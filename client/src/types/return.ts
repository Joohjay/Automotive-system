import type { PaymentMethod } from '@/types/sale'

export type ReturnStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'
export type ReturnItemCondition = 'NEW' | 'DAMAGED'
export type StockTreatment = 'RESTOCK' | 'DAMAGE' | 'DISCARD' | 'DONATE'

export interface Return {
  id: string
  branchId: string
  returnNumber: string
  saleId: string | null
  customerId: string | null
  reason: string | null
  totalRefund: string
  status: ReturnStatus
  returnDate: string
  customer?: { id: string; name: string } | null
  sale?: { id: string; receiptNumber: string } | null
  createdBy?: { id: string; fullName: string } | null
  _count?: { items: number }
}

export interface ReturnItem {
  id: string
  returnId: string
  productId: string
  quantity: number
  unitPrice: string
  reason: string | null
  condition: ReturnItemCondition
  stockTreatment: StockTreatment
  product?: { id: string; name: string; sku: string }
}

export interface ReturnDetail extends Return {
  items: ReturnItem[]
}

export interface ReturnItemInput {
  productId: string
  quantity: number
  reason?: string | null
  condition: ReturnItemCondition
  stockTreatment: StockTreatment
}

export interface ReturnInput {
  saleId?: string | null
  customerId?: string | null
  locationId?: string
  reason?: string | null
  refundMethod: PaymentMethod
  items: ReturnItemInput[]
}
