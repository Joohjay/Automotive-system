import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
import { createCreditPayment } from '@/services/customer.service'
import type { Customer } from '@/types/customer'

export function CreditPaymentDialog({
  customer,
  open,
  onOpenChange,
  onDone,
}: {
  customer: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const { settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'CASH' | 'MPESA' | 'OTHER'>('CASH')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const balance = customer?.creditAccount?.outstandingBalance ?? '0'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!customer) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (value > Number(balance)) {
      setError(`Amount exceeds the outstanding balance of ${formatMoney(balance, currency)}.`)
      return
    }
    setSaving(true)
    try {
      await createCreditPayment(customer.id, {
        amount: value,
        method,
        reference: reference.trim() || null,
        note: note.trim() || null,
      })
      toast.success('Credit payment recorded')
      onDone()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record credit payment</DialogTitle>
          <DialogDescription>
            {customer?.name} — outstanding {formatMoney(balance, currency)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-amount">Amount</Label>
            <Input
              id="cp-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as 'CASH' | 'MPESA' | 'OTHER')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="MPESA">M-Pesa</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-ref">Reference</Label>
              <Input
                id="cp-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Receipt no / txn id"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-note">Note</Label>
            <Input
              id="cp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
