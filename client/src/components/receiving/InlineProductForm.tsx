import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProduct } from '@/services/product.service'
import { listCategories, listBrands } from '@/services/referenceData.service'
import type { Product } from '@/types/product'

interface InlineProductFormProps {
  initialName: string
  onCreated: (product: Product) => void
  onCancel: () => void
}

export function InlineProductForm({ initialName, onCreated, onCancel }: InlineProductFormProps) {
  const [name, setName] = useState(initialName)
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [minStockLevel, setMinStockLevel] = useState('5')
  const [reorderQty, setReorderQty] = useState('20')
  const [unitOfMeasure] = useState('pcs')

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [cats, brs] = await Promise.all([listCategories(), listBrands()])
        setCategories(cats)
        setBrands(brs)
      } catch {
        // ignore
      }
    })()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Product name is required.'); return }
    if (!categoryId) { setError('Category is required.'); return }
    if (!sellingPrice || Number(sellingPrice) <= 0) { setError('Selling price must be greater than 0.'); return }

    setSaving(true)
    try {
      const autoSku = sku.trim().toUpperCase() || `SKU-${Date.now().toString(36).toUpperCase()}`
      const product = await createProduct({
        name: name.trim(),
        sku: autoSku,
        categoryId,
        brandId: brandId || null,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice),
        minStockLevel: Number(minStockLevel) || 5,
        reorderQty: Number(reorderQty) || 20,
        unitOfMeasure,
        status: 'ACTIVE',
      })
      toast.success(`Product "${product.name}" created`)
      onCreated(product)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-lg border bg-card p-3 space-y-3">
      <p className="text-sm font-medium">New product</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" autoFocus />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SKU</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto-generated if blank" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category *</Label>
          <Select value={categoryId || undefined} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Brand</Label>
          <Select value={brandId || undefined} onValueChange={setBrandId}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Purchase price</Label>
          <Input type="number" min="0" step="any" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Selling price *</Label>
          <Input type="number" min="0" step="any" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="Required" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min stock</Label>
          <Input type="number" min="0" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reorder qty</Label>
          <Input type="number" min="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
        </div>
      </div>
      {error && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Create product
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
