import { useEffect, useState } from 'react'
import { Ban, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
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
import { getSale, voidSale } from '@/services/sale.service'
import { ReceiptDialog } from '@/components/pos/ReceiptDialog'
import type { SaleDetail, SaleStatus } from '@/types/sale'

const STATUS_BADGE: Record<SaleStatus, 'default' | 'success' | 'destructive' | 'secondary' | 'warning'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  VOID: 'destructive',
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CREDIT: 'Credit',
  OTHER: 'Other',
}

export function SaleDetailDialog({
  saleId,
  open,
  onOpenChange,
  onChanged,
}: {
  saleId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const { hasPermission, settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const canVoid = hasPermission('sale.void')

  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)

  useEffect(() => {
    if (!open || !saleId) return
    setSale(null)
    setLoading(true)
    void (async () => {
      try {
        setSale(await getSale(saleId))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load sale.')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, saleId])

  const isToday = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    )
  }

  async function handleVoid() {
    if (!sale) return
    setVoiding(true)
    try {
      await voidSale(sale.id)
      toast.success('Sale voided and stock restored')
      setConfirmVoid(false)
      onChanged()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to void sale.')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{sale?.receiptNumber ?? '…'}</span>
              {sale ? <Badge variant={STATUS_BADGE[sale.status]}>{sale.status}</Badge> : null}
            </DialogTitle>
            <DialogDescription>
              {sale ? formatDateTime(sale.saleDate) : ''}
              {sale?.createdBy ? ` · Cashier: ${sale.createdBy.fullName}` : ''}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin" />
            </div>
          ) : !sale ? null : (
            <div className="space-y-4">
              {sale.customer ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{sale.customer.name}</span>
                </div>
              ) : null}

              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">
                          {item.product?.name}
                          <span className="text-muted-foreground text-xs"> ({item.product?.sku})</span>
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(item.unitPrice, currency)}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(item.lineTotal, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(sale.subtotal, currency)}</span>
                </div>
                {Number(sale.discount) > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span>-{formatMoney(sale.discount, currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(sale.total, currency)}</span>
                </div>
              </div>

              <div className="space-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
                {sale.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{PAYMENT_LABEL[p.method] ?? p.method}</span>
                    <span>
                      {formatMoney(p.amount, currency)}
                      {p.status === 'REFUNDED' ? <Badge variant="secondary" className="ml-2">refunded</Badge> : null}
                    </span>
                  </div>
                ))}
                {Number(sale.changeDue) > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Change given</span>
                    <span>{formatMoney(sale.changeDue, currency)}</span>
                  </div>
                ) : null}
              </div>

              {sale.returns.length > 0 ? (
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground text-xs font-medium">Returns against this sale</p>
                  {sale.returns.map((r) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <span className="font-mono text-xs">{r.returnNumber}</span>
                      <span>{formatMoney(r.totalRefund, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setReceiptOpen(true)}>
                  <Printer /> Receipt
                </Button>
                {canVoid && sale.status === 'COMPLETED' ? (
                  <Button variant="destructive" onClick={() => setConfirmVoid(true)}>
                    <Ban /> Void sale
                  </Button>
                ) : null}
              </div>
              {sale.status === 'COMPLETED' && !isToday(sale.saleDate) ? (
                <p className="text-muted-foreground text-xs">
                  Voiding is only available for sales made today.
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmVoid} onOpenChange={setConfirmVoid}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              {sale?.receiptNumber} will be marked void, payments refunded and the items returned to
              stock. This is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Keep sale</AlertDialogCancel>
            <AlertDialogAction
              disabled={voiding}
              onClick={(e) => {
                e.preventDefault()
                void handleVoid()
              }}
            >
              {voiding ? <Loader2 className="animate-spin" /> : null}
              Void sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReceiptDialog
        sale={sale}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />
    </>
  )
}
