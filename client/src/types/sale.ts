import type { Customer } from '@/types/customer'

export type SaleStatus = 'PENDING' | 'COMPLETED' | 'VOID'
export type PaymentMethod = 'CASH' | 'MPESA' | 'CREDIT' | 'OTHER'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'

export interface Sale {
  id: string
  branchId: string
  receiptNumber: string
  customerId: string | null
  subtotal: string
  discount: string
  total: string
  status: SaleStatus
  notes: string | null
  saleDate: string
  createdAt: string
  customer: { id: string; name: string } | null
  createdBy?: { id: string; fullName: string } | null
  _count?: { items: number; payments: number; returns: number }
}

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  quantity: number
  unitPrice: string
  discount: string
  lineTotal: string
  product?: { id: string; name: string; sku: string; unitOfMeasure: string }
}

export interface SalePayment {
  id: string
  saleId: string
  method: PaymentMethod
  amount: string
  reference: string | null
  status: PaymentStatus
  paidAt: string
}

export interface SaleDetail extends Sale {
  items: SaleItem[]
  payments: SalePayment[]
  customer: Customer | null
  returns: {
    id: string
    returnNumber: string
    totalRefund: string
    status: string
    returnDate: string
  }[]
}

export interface SaleItemInput {
  productId: string
  quantity: number
  unitPrice?: number
}

export interface SalePaymentInput {
  method: PaymentMethod
  amount: number
  reference?: string | null
}

export interface SaleInput {
  items: SaleItemInput[]
  discount?: number
  customerId?: string | null
  locationId?: string
  payments: SalePaymentInput[]
  notes?: string | null
}
