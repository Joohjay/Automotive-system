import type { Supplier } from '@/types/supplier'

export type PurchaseStatus = 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

export interface Purchase {
  id: string
  branchId: string
  supplierId: string
  reference: string
  purchaseDate: string
  status: PurchaseStatus
  subtotal: string
  discount: string
  total: string
  notes: string | null
  createdAt: string
  updatedAt: string
  supplier: { id: string; name: string }
  _count?: { items: number }
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  productId: string
  quantity: number
  receivedQty: number
  unitCost: string
  totalCost: string
  createdAt: string
  product?: { id: string; name: string; sku: string; unitOfMeasure: string }
}

export interface PurchaseDetail extends Purchase {
  supplier: Supplier
  items: PurchaseItem[]
  createdBy?: { id: string; fullName: string } | null
}

export interface PurchaseItemInput {
  productId: string
  quantity: number
  unitCost: string | number
}

export interface PurchaseInput {
  supplierId: string
  reference: string
  discount?: string | number
  notes?: string | null
  items: PurchaseItemInput[]
}