import type { Paginated } from '@/types/product'

export type TransactionType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'TRANSFER'

export interface InventoryTransaction {
  id: string
  type: TransactionType
  quantity: number
  note: string | null
  createdAt: string
  product: { name: string; sku: string }
  location: { name: string; code: string } | null
}

export interface OutOfStockItem {
  productId: string
  name: string
  sku: string
  partNumber: string | null
  brand: string | null
  quantityOnHand: number
  locationCode: string
  locationName: string
}

export interface InventorySummary {
  totalProducts: number
  totalUnits: number
  lowStock: number
  outOfStock: number
  outOfStockItems: OutOfStockItem[]
  recentReceived: InventoryTransaction[]
  recentMovements: InventoryTransaction[]
}

export interface StockRow {
  id: string
  quantityOnHand: number
  product: {
    id: string
    name: string
    sku: string
    partNumber: string | null
    sellingPrice: string
    minStockLevel: number
    status: string
    unitOfMeasure: string
    brand: { name: string } | null
    category: { name: string } | null
  }
  location: { code: string; name: string }
}

export type { Paginated }