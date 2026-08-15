import { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { createPurchase } from '@/services/purchase.service'
import { listProducts } from '@/services/product.service'
import { listSuppliers } from '@/services/supplier.service'
import type { Product } from '@/types/product'
import type { Supplier } from '@/types/supplier'

interface Line {
  key: number
  productId: string
  quantity: string
  unitCost: string
}

export function PurchaseFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([{ key: 1, productId: '', quantity: '', unitCost: '' }])
  const [nextKey, setNextKey] = useState(2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSupplierId('')
    setReference('')
    setDiscount('0')
    setNotes('')
    setLines([{ key: 1, productId: '', quantity: '', unitCost: '' }])
    setNextKey(2)
    void (async () => {
      const [s, p] = await Promise.all([
        listSuppliers({ status: 'ACTIVE', pageSize: 200 }),
        listProducts({ status: 'ACTIVE', pageSize: 200 }),
      ])
      setSuppliers(s.data)
      setProducts(p.data)
    })()
  }, [open])

  const subtotal = lines.reduce((acc, l) => {
    const qty = Number(l.quantity) || 0
    const cost = Number(l.unitCost) || 0
    return acc + qty * cost
  }, 0)
  const total = Math.max(0, subtotal - (Number(discount) || 0))

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, { key: nextKey, productId: '', quantity: '', unitCost: '' }])
    setNextKey((k) => k + 1)
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!supplierId || !reference.trim()) {
      setError('Supplier and reference are required.')
      return
    }
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost) || 0,
      }))
    if (items.length === 0) {
      setError('Add at least one item with a quantity.')
      return
    }
    setSaving(true)
    try {
      await createPurchase({
        supplierId,
        reference: reference.trim(),
        discount: Number(discount) || 0,
        notes: notes || null,
        items,
      })
      toast.success('Purchase order created')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create purchase order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>Order goods from a supplier. Stock is added when received.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={supplierId || undefined} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No active suppliers
                    </SelectItem>
                  ) : (
                    suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-ref">Invoice / reference</Label>
              <Input id="po-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-2026-001" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="po-notes">Notes</Label>
              <Textarea id="po-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line) => {
                const product = products.find((p) => p.id === line.productId)
                return (
                  <div key={line.key} className="grid grid-cols-12 items-center gap-2">
                    <Select
                      value={line.productId || undefined}
                      onValueChange={(v) => updateLine(line.key, { productId: v })}
                    >
                      <SelectTrigger className="col-span-6">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="col-span-2"
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Unit cost"
                      value={line.unitCost}
                      onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 />
                    </Button>
                    {product ? (
                      <p className="text-muted-foreground col-span-10 col-start-1 pl-2 text-xs">
                        Stock on hand: {product.stock.quantityOnHand}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 border-t pt-3 text-sm">
            <p className="text-muted-foreground">
              Subtotal: <span className="font-medium text-foreground">{subtotal.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="po-discount" className="text-muted-foreground font-normal">
                Discount
              </Label>
              <Input
                id="po-discount"
                className="h-8 w-32"
                type="number"
                min="0"
                step="any"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <p className="text-base font-semibold">Total: {total.toLocaleString()}</p>
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
              Create purchase order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}