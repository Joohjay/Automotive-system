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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createCustomer, updateCustomer } from '@/services/customer.service'
import type { Customer, CustomerInput } from '@/types/customer'

interface FormState {
  name: string
  phone: string
  email: string
  address: string
  customerType: 'RETAIL' | 'WHOLESALE'
  creditEligible: boolean
  creditLimit: string
  status: 'ACTIVE' | 'INACTIVE'
}

const emptyForm: FormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  customerType: 'RETAIL',
  creditEligible: false,
  creditLimit: '0',
  status: 'ACTIVE',
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            address: customer.address ?? '',
            customerType: customer.customerType,
            creditEligible: customer.creditEligible,
            creditLimit: customer.creditLimit,
            status: customer.status,
          }
        : emptyForm,
    )
  }, [open, customer])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('Customer name is required.')
      return
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Enter a valid email address.')
      return
    }
    setSaving(true)
    const input: CustomerInput = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      customerType: form.customerType,
      creditEligible: form.creditEligible,
      creditLimit: Number(form.creditLimit) || 0,
      status: form.status,
    }
    try {
      if (customer) {
        await updateCustomer(customer.id, input)
        toast.success('Customer updated')
      } else {
        await createCustomer(input)
        toast.success('Customer created')
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save customer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit customer' : 'Add customer'}</DialogTitle>
          <DialogDescription>
            Customers with credit eligibility get a credit account that tracks their balance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="c-name">Full name</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. James Mwangi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+255 7xx xxx xxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Customer type</Label>
              <Select value={form.customerType} onValueChange={(v) => set('customerType', v as 'RETAIL' | 'WHOLESALE')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETAIL">Retail</SelectItem>
                  <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as 'ACTIVE' | 'INACTIVE')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="c-address">Address</Label>
              <Textarea
                id="c-address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Street, city"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Credit eligible</p>
                <p className="text-muted-foreground text-xs">
                  Allows charging sales to this customer's credit account.
                </p>
              </div>
              <Switch checked={form.creditEligible} onCheckedChange={(v) => set('creditEligible', v)} />
            </div>
            {form.creditEligible ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="c-limit">Credit limit (0 = unlimited)</Label>
                <Input
                  id="c-limit"
                  type="number"
                  min="0"
                  step="any"
                  value={form.creditLimit}
                  onChange={(e) => set('creditLimit', e.target.value)}
                />
              </div>
            ) : null}
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
              {customer ? 'Save changes' : 'Create customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
