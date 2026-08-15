import { useEffect, useState } from 'react'
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
import { createSupplier, updateSupplier } from '@/services/supplier.service'
import type { Supplier, SupplierInput } from '@/types/supplier'

const empty: SupplierInput = { name: '', status: 'ACTIVE' }

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<SupplierInput>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      supplier
        ? {
            name: supplier.name,
            contactPerson: supplier.contactPerson ?? '',
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            address: supplier.address ?? '',
            taxNumber: supplier.taxNumber ?? '',
            status: supplier.status,
          }
        : empty,
    )
  }, [open, supplier])

  function set<K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name?.trim()) {
      setError('Supplier name is required.')
      return
    }
    setSaving(true)
    const input: SupplierInput = {
      ...form,
      name: form.name.trim(),
      contactPerson: form.contactPerson?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
      taxNumber: form.taxNumber?.trim() || null,
    }
    try {
      if (supplier) {
        await updateSupplier(supplier.id, input)
        toast.success('Supplier updated')
      } else {
        await createSupplier(input)
        toast.success('Supplier created')
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save supplier.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
          <DialogDescription>Vendor details for purchase orders and receiving.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="s-name">Supplier name</Label>
              <Input
                id="s-name"
                value={form.name ?? ''}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Gulf Distributors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-contact">Contact person</Label>
              <Input
                id="s-contact"
                value={form.contactPerson ?? ''}
                onChange={(e) => set('contactPerson', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-tax">Tax number</Label>
              <Input id="s-tax" value={form.taxNumber ?? ''} onChange={(e) => set('taxNumber', e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="s-address">Address</Label>
              <Input id="s-address" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Status</Label>
              <Select
                value={form.status ?? 'ACTIVE'}
                onValueChange={(v) => set('status', v as 'ACTIVE' | 'INACTIVE')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
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
              {supplier ? 'Save changes' : 'Create supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}