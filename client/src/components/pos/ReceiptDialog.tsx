import { useEffect } from 'react'
import { Printer, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { SaleDetail } from '@/types/sale'

const PRINT_STYLE_ID = 'receipt-print-styles'

export function ReceiptDialog({
  sale,
  open,
  onOpenChange,
}: {
  sale: SaleDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const businessName = settings?.businessName ?? 'BennyBlax Enterprises'

  useEffect(() => {
    if (!open) return
    const style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        .receipt-print, .receipt-print * { visibility: visible !important; }
        .receipt-print { position: fixed; inset: 0; padding: 24px; background: white; color: black; }
        .no-print { display: none !important; }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.getElementById(PRINT_STYLE_ID)?.remove()
    }
  }, [open])

  if (!sale) return null

  const paymentLabel: Record<string, string> = {
    CASH: 'Cash',
    MPESA: 'M-Pesa',
    CREDIT: 'Credit',
    OTHER: 'Other',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="no-print">
          <DialogTitle>Sale complete</DialogTitle>
          <DialogDescription>Print the receipt for this transaction.</DialogDescription>
        </DialogHeader>

        <div className="receipt-print mx-auto w-full max-w-xs space-y-3 text-sm">
          <div className="text-center">
            <p className="text-base font-bold">{businessName}</p>
            <p className="text-muted-foreground text-xs">Receipt {sale.receiptNumber}</p>
            <p className="text-muted-foreground text-xs">{formatDateTime(sale.saleDate)}</p>
          </div>

          {sale.customer ? (
            <p className="text-xs">
              Customer: <span className="font-medium">{sale.customer.name}</span>
            </p>
          ) : null}

          <div className="divide-y border-y">
            {sale.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <p className="font-medium">{item.product?.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.quantity} × {formatMoney(item.unitPrice, currency)}
                  </p>
                </div>
                <p className="shrink-0 font-medium">{formatMoney(item.lineTotal, currency)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-0.5 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(sale.subtotal, currency)}</span>
            </div>
            {Number(sale.discount) > 0 ? (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{formatMoney(sale.discount, currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatMoney(sale.total, currency)}</span>
            </div>
          </div>

          <div className="space-y-0.5 border-t pt-2">
            {sale.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-xs">
                <span>{paymentLabel[p.method] ?? p.method}</span>
                <span>{formatMoney(p.amount, currency)}</span>
              </div>
            ))}
          </div>

          {sale.notes ? <p className="text-muted-foreground text-xs">{sale.notes}</p> : null}

          <p className="text-muted-foreground pt-1 text-center text-xs">
            {settings?.receiptFooter || 'Thank you for your business!'}
          </p>
        </div>

        <div className="no-print flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              window.print()
            }}
          >
            <Printer /> Print receipt
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
