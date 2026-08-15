import { Badge } from '@/components/ui/badge'
import { stockStatus } from '@/lib/stock'

export function StockBadge({
  quantityOnHand,
  minStockLevel,
}: {
  quantityOnHand: number
  minStockLevel: number
}) {
  const status = stockStatus(quantityOnHand, minStockLevel)
  const variant =
    status === 'OUT_OF_STOCK' ? 'destructive' : status === 'LOW_STOCK' ? 'warning' : 'success'
  const label =
    status === 'OUT_OF_STOCK'
      ? 'Out of stock'
      : status === 'LOW_STOCK'
        ? 'Low stock'
        : 'In stock'
  return (
    <Badge variant={variant}>
      {label} · {quantityOnHand}
    </Badge>
  )
}