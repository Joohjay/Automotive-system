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
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { createPurchase } from '@/services/purchase.service'
import { listSuppliers } from '@/services/supplier.service'
import { listProducts } from '@/services/product.service'
import type { Product } from '@/types/product'
import type { Supplier } from '@/types/supplier'
import { InlineSupplierForm } from '@/components/receiving/InlineSupplierForm'
import { InlineProductForm } from '@/components/receiving/InlineProductForm'

interface Line {
  key: number
  productId: string
  quantity: string
  unitCost: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
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
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayStr)
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([{ key: 1, productId: '', quantity: '', unitCost: '' }])
  const [nextKey, setNextKey] = useState(2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [showNewProduct, setShowNewProduct] = useState<number | null>(null)
  const [newProductName, setNewProductName] = useState('')

  const [productCache, setProductCache] = useState<Map<string, Product>>(new Map())

  useEffect(() => {
    if (!open) return
    setError(null)
    setSupplierId('')
    setReference('')
    setPurchaseDate(todayStr())
    setDiscount('0')
    setNotes('')
    setLines([{ key: 1, productId: '', quantity: '', unitCost: '' }])
    setNextKey(2)
    setShowNewSupplier(false)
    setShowNewProduct(null)
    setProductCache(new Map())
  }, [open])

  const subtotal = lines.reduce((acc, l) => {
    const qty = Number(l.quantity) || 0
    const cost = Number(l.unitCost) || 0
    return acc + qty * cost
  }, 0)
  const grandTotal = Math.max(0, subtotal - (Number(discount) || 0))

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

  async function searchSuppliers(q: string): Promise<SearchableOption[]> {
    try {
      const res = await listSuppliers({ search: q, status: 'ACTIVE', pageSize: 20 })
      return res.data.map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: [s.contactPerson, s.phone].filter(Boolean).join(' · ') || undefined,
      }))
    } catch { return [] }
  }

  async function searchProducts(q: string): Promise<SearchableOption[]> {
    try {
      const res = await listProducts({ search: q, status: 'ACTIVE', pageSize: 20 })
      for (const p of res.data) {
        setProductCache((prev) => new Map(prev).set(p.id, p))
      }
      return res.data.map((p) => ({
        id: p.id,
        label: `${p.name} (${p.sku})`,
        sublabel: `${Number(p.purchasePrice).toLocaleString()} purchase · Stock: ${p.stock.quantityOnHand}`,
      }))
    } catch { return [] }
  }

  function handleSupplierCreated(supplier: Supplier) {
    setSupplierId(supplier.id)
    setShowNewSupplier(false)
  }

  function handleProductCreated(product: Product) {
    setProductCache((prev) => new Map(prev).set(product.id, product))
    if (showNewProduct !== null) {
      updateLine(showNewProduct, { productId: product.id })
    }
    setShowNewProduct(null)
  }

  function handleOpenNewSupplier(query: string) {
    setNewSupplierName(query)
    setShowNewSupplier(true)
  }

  function handleOpenNewProduct(lineKey: number, query: string) {
    setNewProductName(query)
    setShowNewProduct(lineKey)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!supplierId) { setError('Select a supplier.'); return }
    if (!reference.trim()) { setError('Enter a purchase reference/invoice number.'); return }

    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost) || 0,
      }))
    if (items.length === 0) { setError('Add at least one item with a quantity greater than 0.'); return }

    for (const [i, item] of items.entries()) {
      if (item.unitCost < 0) { setError(`Item ${i + 1}: unit cost cannot be negative.`); return }
    }

    setSaving(true)
    try {
      await createPurchase({
        supplierId,
        reference: reference.trim(),
        purchaseDate: new Date(purchaseDate),
        discount: Number(discount) || 0,
        notes: notes.trim() || null,
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>Order goods from a supplier. Stock is added when received.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Purchase information</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Supplier *</Label>
                {showNewSupplier ? (
                  <InlineSupplierForm
                    initialName={newSupplierName}
                    onCreated={handleSupplierCreated}
                    onCancel={() => setShowNewSupplier(false)}
                  />
                ) : (
                  <SearchableSelect
                    value={supplierId}
                    onChange={setSupplierId}
                    onSearch={searchSuppliers}
                    onCreateNew={handleOpenNewSupplier}
                    placeholder="Search supplier by name…"
                    createNewLabel="Add new supplier"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="po-ref">Invoice / reference *</Label>
                <Input
                  id="po-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="INV-2026-001"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="po-date">Order date</Label>
                <Input
                  id="po-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="po-discount">Order discount</Label>
                <Input
                  id="po-discount"
                  type="number"
                  min="0"
                  step="any"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="po-notes">Notes</Label>
                <Textarea
                  id="po-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional — delivery notes, special instructions…"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Items</p>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line) => {
                const product = productCache.get(line.productId)
                const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitCost) || 0)
                return (
                  <div key={line.key} className="space-y-1.5 rounded-lg border p-3">
                    <div className="grid grid-cols-12 items-start gap-2">
                      <div className="col-span-6">
                        {showNewProduct === line.key ? (
                          <InlineProductForm
                            initialName={newProductName}
                            onCreated={handleProductCreated}
                            onCancel={() => setShowNewProduct(null)}
                          />
                        ) : (
                          <SearchableSelect
                            value={line.productId}
                            onChange={(v) => updateLine(line.key, { productId: v })}
                            onSearch={searchProducts}
                            onCreateNew={(q) => handleOpenNewProduct(line.key, q)}
                            placeholder="Search product…"
                            createNewLabel="Add new product"
                          />
                        )}
                      </div>
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
                        className="shrink-0"
                        disabled={lines.length === 1}
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {product && (
                      <p className="text-muted-foreground pl-1 text-xs">
                        {product.category?.name && <span>{product.category.name} · </span>}
                        {product.brand?.name && <span>{product.brand.name} · </span>}
                        Stock: {product.stock.quantityOnHand} · Line total: {lineTotal.toLocaleString()}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Summary</p>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{subtotal.toLocaleString()}</span>
              </div>
              {Number(discount) > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium tabular-nums text-destructive">−{Number(discount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-4 border-t pt-1">
                <span className="font-semibold">Grand total</span>
                <span className="text-base font-bold tabular-nums">{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create purchase order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
