export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export function stockStatus(
  quantityOnHand: number,
  minStockLevel: number,
): StockStatus {
  if (quantityOnHand <= 0) return 'OUT_OF_STOCK'
  if (quantityOnHand <= minStockLevel) return 'LOW_STOCK'
  return 'IN_STOCK'
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
}