import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
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
import {
  createBrand,
  createCategory,
  listBrands,
  listCategories,
} from '@/services/referenceData.service'
import { createProduct, updateProduct } from '@/services/product.service'
import type { Brand, Category, Product, ProductCreateInput } from '@/types/product'

interface FormState {
  name: string
  sku: string
  categoryId: string
  brandId: string
  purchasePrice: string
  sellingPrice: string
  minStockLevel: string
  reorderQty: string
  unitOfMeasure: string
  barcode: string
  status: 'ACTIVE' | 'INACTIVE'
  description: string
}

function EntitySelect({
  label,
  value,
  options,
  placeholder,
  allowCreate,
  onCreate,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; name: string }[]
  placeholder: string
  allowCreate: boolean
  onCreate: (name: string) => Promise<string>
  onChange: (value: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {creating ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder={`New ${label.toLowerCase()} name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void (async () => {
                  if (!newName.trim()) return
                  setBusy(true)
                  try {
                    const id = await onCreate(newName.trim())
                    onChange(id)
                    setCreating(false)
                    setNewName('')
                  } finally {
                    setBusy(false)
                  }
                })()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={busy || !newName.trim()}
            onClick={() => {
              void (async () => {
                setBusy(true)
                try {
                  const id = await onCreate(newName.trim())
                  onChange(id)
                  setCreating(false)
                  setNewName('')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No {label.toLowerCase()} yet
                </SelectItem>
              ) : (
                options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {allowCreate ? (
            <Button type="button" variant="outline" size="icon" onClick={() => setCreating(true)}>
              <Plus />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

const emptyForm: FormState = {
  name: '',
  sku: '',
  categoryId: '',
  brandId: '',
  purchasePrice: '',
  sellingPrice: '',
  minStockLevel: '0',
  reorderQty: '0',
  unitOfMeasure: 'pcs',
  barcode: '',
  status: 'ACTIVE',
  description: '',
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      product
        ? {
            name: product.name,
            sku: product.sku,
            categoryId: product.category?.id ?? '',
            brandId: product.brand?.id ?? '',
            purchasePrice: product.purchasePrice,
            sellingPrice: product.sellingPrice,
            minStockLevel: String(product.minStockLevel),
            reorderQty: String(product.reorderQty),
            unitOfMeasure: product.unitOfMeasure,
            barcode: product.barcode ?? '',
            status: product.status,
            description: product.description ?? '',
          }
        : emptyForm,
    )
    void (async () => {
      const [c, b] = await Promise.all([listCategories(), listBrands()])
      setCategories(c)
      setBrands(b)
    })()
  }, [open, product])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim() || !form.sku.trim() || !form.categoryId) {
      setError('Name, SKU and category are required.')
      return
    }
    if (!Number.isFinite(Number(form.sellingPrice)) || Number(form.sellingPrice) < 0) {
      setError('Selling price must be a valid amount.')
      return
    }
    setSaving(true)
    const input: ProductCreateInput = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      categoryId: form.categoryId,
      brandId: form.brandId || null,
      description: form.description || null,
      purchasePrice: form.purchasePrice || '0',
      sellingPrice: form.sellingPrice,
      minStockLevel: Number(form.minStockLevel) || 0,
      reorderQty: Number(form.reorderQty) || 0,
      unitOfMeasure: form.unitOfMeasure.trim() || 'pcs',
      barcode: form.barcode || null,
      status: form.status,
    }
    try {
      if (product) {
        await updateProduct(product.id, input)
        toast.success('Product updated')
      } else {
        await createProduct(input)
        toast.success('Product created')
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle>
          <DialogDescription>
            Enter the part details. SKU must be unique across the business.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-name">Product name</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Brake Pad Toyota Premio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-sku">SKU</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                placeholder="BP-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-uom">Unit of measure</Label>
              <Input
                id="p-uom"
                value={form.unitOfMeasure}
                onChange={(e) => set('unitOfMeasure', e.target.value)}
                placeholder="pcs / set / litre"
              />
            </div>
            <div className="sm:col-span-2">
              <EntitySelect
                label="Category"
                value={form.categoryId}
                options={categories}
                placeholder="Select category"
                allowCreate
                onCreate={async (name) => {
                  const c = await createCategory({ name })
                  setCategories((prev) => [...prev, c])
                  return c.id
                }}
                onChange={(v) => set('categoryId', v)}
              />
            </div>
            <div className="sm:col-span-2">
              <EntitySelect
                label="Brand"
                value={form.brandId}
                options={brands}
                placeholder="No brand (optional)"
                allowCreate
                onCreate={async (name) => {
                  const b = await createBrand({ name })
                  setBrands((prev) => [...prev, b])
                  return b.id
                }}
                onChange={(v) => set('brandId', v)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-buy">Purchase price</Label>
              <Input
                id="p-buy"
                type="number"
                min="0"
                step="any"
                value={form.purchasePrice}
                onChange={(e) => set('purchasePrice', e.target.value)}
                placeholder="60000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-sell">Selling price</Label>
              <Input
                id="p-sell"
                type="number"
                min="0"
                step="any"
                value={form.sellingPrice}
                onChange={(e) => set('sellingPrice', e.target.value)}
                placeholder="85000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-min">Min stock level</Label>
              <Input
                id="p-min"
                type="number"
                min="0"
                value={form.minStockLevel}
                onChange={(e) => set('minStockLevel', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-reorder">Reorder qty</Label>
              <Input
                id="p-reorder"
                type="number"
                min="0"
                value={form.reorderQty}
                onChange={(e) => set('reorderQty', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-barcode">Barcode (optional)</Label>
              <Input
                id="p-barcode"
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as 'ACTIVE' | 'INACTIVE')}>
                <SelectTrigger id="p-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional notes"
              />
            </div>
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
              {product ? 'Save changes' : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}