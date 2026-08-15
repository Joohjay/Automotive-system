import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { listCustomers } from '@/services/customer.service'
import { listProducts } from '@/services/product.service'
import { createReturn } from '@/services/return.service'
import { getSale, listSales } from '@/services/sale.service'
import type { Customer } from '@/types/customer'
import type { Product } from '@/types/product'
import type { ReturnItemCondition, StockTreatment } from '@/types/return'
import type { PaymentMethod, SaleDetail } from '@/types/sale'

interface ReturnLine {
  key: number
  productId: string
  productName: string
  unitPrice: number
  maxQty: number
  quantity: number
  condition: ReturnItemCondition
  stockTreatment: StockTreatment
}

const CONDITION_LABEL: Record<ReturnItemCondition, string> = { NEW: 'New', DAMAGED: 'Damaged' }
const TREATMENT_LABEL: Record<StockTreatment, string> = {
  RESTOCK: 'Restock',
  DAMAGE: 'Write off as damaged',
  DISCARD: 'Discard',
  DONATE: 'Donate',
}

export function ReturnFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { hasPermission, settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const canReturn = hasPermission('sale.return')

  const [mode, setMode] = useState<'sale' | 'walkin'>('sale')
  const [sales, setSales] = useState<{ id: string; receiptNumber: string; total: string; saleDate: string }[]>([])
  const [saleId, setSaleId] = useState('')
  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('CASH')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<ReturnLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextKey = useMemo(() => Date.now(), [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setMode('sale')
    setSaleId('')
    setSale(null)
    setCustomerId('')
    setRefundMethod('CASH')
    setReason('')
    setLines([])
    void (async () => {
      const [c, cust] = await Promise.all([listCustomers(), listSales({ pageSize: 50 })])
      setCustomers(c.data)
      setSales(salesFilter(cust.data))
    })()
  }, [open])

  function salesFilter(rows: { id: string; receiptNumber: string; total: string; saleDate: string; status: string }[]) {
    return rows.filter((r) => r.status === 'COMPLETED').map(({ id, receiptNumber, total, saleDate }) => ({ id, receiptNumber, total, saleDate }))
  }

  async function loadSale(id: string) {
    setSaleId(id)
    if (!id) {
      setSale(null)
      setLines([])
      return
    }
    try {
      const detail = await getSale(id)
      setSale(detail)
      if (detail.customer) setCustomerId(detail.customer.id)
      setLines(
        detail.items.map((item, i) => ({
          key: nextKey + i,
          productId: item.productId,
          productName: item.product?.name ?? item.productId,
          unitPrice: Number(item.unitPrice),
          maxQty: item.quantity,
          quantity: 0,
          condition: 'NEW' as const,
          stockTreatment: 'RESTOCK' as const,
        })),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sale.')
    }
  }

  function addWalkInLine() {
    const available = products.filter((p) => !lines.some((l) => l.productId === p.id))
    const product = available[0]
    setLines((prev) => [
      ...prev,
      {
        key: Date.now() + Math.random(),
        productId: product?.id ?? '',
        productName: product?.name ?? '',
        unitPrice: Number(product?.sellingPrice ?? 0),
        maxQty: 999999,
        quantity: 1,
        condition: 'NEW',
        stockTreatment: 'RESTOCK',
      },
    ])
  }

  async function handleModeChange(next: 'sale' | 'walkin') {
    setMode(next)
    setSale(null)
    setSaleId('')
    setLines([])
    setCustomerId('')
    if (next === 'walkin') {
      const p = await listProducts({ pageSize: 100 })
      setProducts(p.data)
      setLines([
        {
          key: nextKey,
          productId: '',
          productName: '',
          unitPrice: 0,
          maxQty: 999999,
          quantity: 1,
          condition: 'NEW',
          stockTreatment: 'RESTOCK',
        },
      ])
    } else {
      const res = await listSales({ pageSize: 50 })
      setSales(salesFilter(res.data))
    }
  }

  function updateLine(key: number, patch: Partial<ReturnLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function updateWalkInProduct(key: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    updateLine(key, {
      productId,
      productName: product?.name ?? '',
      unitPrice: Number(product?.sellingPrice ?? 0),
    })
  }

  const selectedLines = lines.filter((l) => l.productId && l.quantity > 0)
  const totalRefund = selectedLines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (selectedLines.length === 0) {
      setError('Return at least one item.')
      return
    }
    if (refundMethod === 'CREDIT' && !customerId) {
      setError('Select a customer to credit the refund to.')
      return
    }
    setSaving(true)
    try {
      await createReturn({
        saleId: mode === 'sale' ? saleId || null : null,
        customerId: customerId || null,
        reason: reason.trim() || null,
        refundMethod,
        items: selectedLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          condition: l.condition,
          stockTreatment: l.stockTreatment,
          reason: null,
        })),
      })
      toast.success(`Refund of ${formatMoney(totalRefund, currency)} processed`)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process the return.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Process a return</DialogTitle>
          <DialogDescription>
            Saleable items are restocked; damaged items are written off. Refunds go back as cash,
            M-Pesa or credit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => void handleModeChange(v as 'sale' | 'walkin')}>
            <TabsList>
              <TabsTrigger value="sale">Against a sale</TabsTrigger>
              <TabsTrigger value="walkin">Walk-in return</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'sale' ? (
            <div className="space-y-2">
              <Label>Completed sale</Label>
              <Select value={saleId || undefined} onValueChange={(v) => void loadSale(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a completed sale" />
                </SelectTrigger>
                <SelectContent>
                  {sales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.receiptNumber} — {formatMoney(s.total, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {lines.length > 0 ? (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">
                      {mode === 'sale' ? 'Item' : 'Product'}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Condition</th>
                    <th className="px-3 py-2 font-medium">Treatment</th>
                    <th className="px-3 py-2 text-right font-medium">Refund</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        {mode === 'sale' ? (
                          l.productName
                        ) : (
                          <Select
                            value={l.productId || undefined}
                            onValueChange={(v) => updateWalkInProduct(l.key, v)}
                          >
                            <SelectTrigger className="min-w-40">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} — {formatMoney(p.sellingPrice, currency)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="ml-auto h-8 w-16 text-right"
                          type="number"
                          min="0"
                          max={l.maxQty}
                          value={l.quantity || ''}
                          onChange={(e) =>
                            updateLine(l.key, { quantity: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={l.condition}
                          onValueChange={(v) => updateLine(l.key, { condition: v as ReturnItemCondition })}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(CONDITION_LABEL) as ReturnItemCondition[]).map((c) => (
                              <SelectItem key={c} value={c}>
                                {CONDITION_LABEL[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={l.stockTreatment}
                          onValueChange={(v) => updateLine(l.key, { stockTreatment: v as StockTreatment })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TREATMENT_LABEL) as StockTreatment[]).map((t) => (
                              <SelectItem key={t} value={t}>
                                {TREATMENT_LABEL[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(l.quantity * l.unitPrice, currency)}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mode === 'walkin' ? (
                <div className="p-2">
                  <Button type="button" variant="outline" size="sm" onClick={addWalkInLine}>
                    <Plus /> Add product
                  </Button>
                </div>
              ) : null}
            </div>
          ) : mode === 'sale' && sale ? (
            <p className="text-muted-foreground text-xs">This sale has no items.</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Refund method</Label>
              <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="MPESA">M-Pesa</SelectItem>
                  <SelectItem value="CREDIT">Credit to account</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {refundMethod === 'CREDIT' ? (
              <div className="space-y-2">
                <Label>Credit customer</Label>
                <Select value={customerId || undefined} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Customer (optional)</Label>
                <Select value={customerId || undefined} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="r-reason">Reason</Label>
            <Textarea
              id="r-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being returned?"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total refund</span>
            <span className="font-semibold">{formatMoney(totalRefund, currency)}</span>
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
            <Button type="submit" disabled={saving || !canReturn}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Process return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
