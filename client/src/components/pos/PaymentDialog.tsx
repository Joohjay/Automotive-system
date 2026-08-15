import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { createSale } from '@/services/sale.service'
import type { Customer } from '@/types/customer'
import type { Sale, SaleInput, SalePaymentInput } from '@/types/sale'

export interface CartLine {
  productId: string
  name: string
  sku: string
  quantity: number
  unitPrice: number
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CREDIT: 'Credit',
  OTHER: 'Other',
}

export function PaymentDialog({
  open,
  onOpenChange,
  cart,
  customers,
  onPaid,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartLine[]
  customers: Customer[]
  onPaid: (sale: Sale) => void
}) {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'

  const subtotal = useMemo(
    () => cart.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0),
    [cart],
  )
  const [discount, setDiscount] = useState('0')
  const [payments, setPayments] = useState<SalePaymentInput[]>([{ method: 'CASH', amount: 0 }])
  const [customerId, setCustomerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = Math.max(0, subtotal - (Number(discount) || 0))
  const paidTotal = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  const change = paidTotal - total
  const usesCredit = payments.some((p) => p.method === 'CREDIT')

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setDiscount('0')
    setPayments([{ method: 'CASH', amount: 0 }])
    setCustomerId('')
  }, [open])

  function updatePayment(index: number, patch: Partial<SalePaymentInput>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function handleQuickAmount(method: SalePaymentInput['method']) {
    const remaining = Math.max(0, total - paidTotal)
    setPayments((prev) => {
      const idx = prev.findIndex((p) => p.method === method)
      if (idx >= 0) {
        return prev.map((p, i) =>
          i === idx ? { ...p, amount: Number(p.amount) + remaining } : p,
        )
      }
      return [...prev, { method, amount: remaining }]
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (cart.length === 0) {
      setError('The cart is empty.')
      return
    }
    if (total <= 0) {
      setError('The sale total must be greater than zero.')
      return
    }
    if (paidTotal < total) {
      setError(`Payments of ${formatMoney(paidTotal, currency)} do not cover ${formatMoney(total, currency)}.`)
      return
    }
    if (usesCredit && !customerId) {
      setError('Select a customer for the credit portion of the payment.')
      return
    }
    const items = cart.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }))
    const input: SaleInput = {
      items,
      discount: Number(discount) || 0,
      customerId: customerId || null,
      payments: payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount) || 0,
        reference: p.reference || null,
      })),
    }
    setSaving(true)
    try {
      const created = await createSale(input)
      onPaid(created)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete the sale.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Charge {cart.length} item{cart.length === 1 ? '' : 's'}</DialogTitle>
          <DialogDescription>Split the total across cash, M-Pesa or credit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatMoney(subtotal, currency)}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pd-discount">Discount</Label>
            <Input
              id="pd-discount"
              type="number"
              min="0"
              step="any"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Payments</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const used = new Set(payments.map((p) => p.method))
                  const available = (['CASH', 'MPESA', 'CREDIT', 'OTHER'] as const).filter(
                    (m) => !used.has(m),
                  )
                  if (available[0]) setPayments((prev) => [...prev, { method: available[0], amount: 0 }])
                }}
                disabled={payments.length >= 4}
              >
                <Plus /> Split payment
              </Button>
            </div>
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={p.method} onValueChange={(v) => updatePayment(i, { method: v as SalePaymentInput['method'] })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['CASH', 'MPESA', 'CREDIT', 'OTHER'] as const).map((m) => (
                        <SelectItem key={m} value={m}>
                          {METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="flex-1"
                    value={p.amount || ''}
                    placeholder="0"
                    onChange={(e) => updatePayment(i, { amount: Number(e.target.value) || 0 })}
                  />
                  {p.reference === undefined ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updatePayment(i, { amount: Math.max(0, total - paidTotal) })}
                    >
                      Exact
                    </Button>
                  ) : null}
                  {payments.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPayments((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {payments.length === 1 && payments[0].amount === 0 ? (
              <div className="flex flex-wrap gap-2">
                {(['CASH', 'MPESA', 'CREDIT'] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(m)}
                  >
                    {METHOD_LABEL[m]}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          {usesCredit ? (
            <div className="space-y-2">
              <Label htmlFor="pd-customer">Customer (credit)</Label>
              <Select value={customerId || undefined} onValueChange={setCustomerId}>
                <SelectTrigger id="pd-customer">
                  <SelectValue placeholder="Select credit customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {formatMoney(c.creditAccount?.outstandingBalance ?? 0, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1 rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatMoney(total, currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatMoney(paidTotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Change</span>
              <span className={change < 0 ? 'font-medium text-red-600' : ''}>
                {formatMoney(Math.max(0, change), currency)}
              </span>
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back to cart
            </Button>
            <Button type="submit" disabled={saving || paidTotal < total}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Complete sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
