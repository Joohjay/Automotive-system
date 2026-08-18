import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { OutOfStockItem } from '@/types/inventory'

export function OutOfStockAlert({
  open,
  onOpenChange,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: OutOfStockItem[]
}) {
  const navigate = useNavigate()

  if (items.length === 0) return null

  const handleView = () => {
    onOpenChange(false)
    navigate('/inventory')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="size-5" />
            Out of Stock Alert
          </DialogTitle>
          <DialogDescription>
            {items.length} product{items.length === 1 ? ' is' : 's are'} completely out of stock.
            Immediate attention may be required.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-muted-foreground text-xs">
                  SKU: {item.sku}
                  {item.partNumber ? <> · Part #: {item.partNumber}</> : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {item.locationCode} — {item.locationName}
                </p>
              </div>
              <Badge variant="destructive" className="shrink-0">
                0 in stock
              </Badge>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continue
          </Button>
          <Button onClick={handleView}>
            View Out-of-Stock Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
