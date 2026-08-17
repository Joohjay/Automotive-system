import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupplier, listSuppliers } from '@/services/supplier.service'
import type { Supplier } from '@/types/supplier'

interface InlineSupplierFormProps {
  initialName: string
  onCreated: (supplier: Supplier) => void
  onCancel: () => void
}

export function InlineSupplierForm({ initialName, onCreated, onCancel }: InlineSupplierFormProps) {
  const [name, setName] = useState(initialName)
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [similarWarning, setSimilarWarning] = useState<Supplier[] | null>(null)

  async function checkSimilar() {
    if (!name.trim()) return
    try {
      const res = await listSuppliers({ search: name.trim(), pageSize: 10 })
      const matches = res.data.filter(
        (s) => s.name.toLowerCase() !== name.trim().toLowerCase(),
      )
      if (matches.length > 0) {
        setSimilarWarning(matches)
        return true
      }
    } catch {
      // ignore search failure
    }
    return false
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Supplier name is required.')
      return
    }

    if (!similarWarning) {
      const hasSimilar = await checkSimilar()
      if (hasSimilar) return
    }

    setSaving(true)
    try {
      const supplier = await createSupplier({
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        taxNumber: null,
        status: 'ACTIVE',
      })
      toast.success(`Supplier "${supplier.name}" created`)
      onCreated(supplier)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier.')
    } finally {
      setSaving(false)
    }
  }

  if (similarWarning) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
        <p className="text-sm font-medium text-amber-800">
          Similar supplier{similarWarning.length > 1 ? 's' : ''} found:
        </p>
        <div className="space-y-1">
          {similarWarning.map((s) => (
            <button
              key={s.id}
              type="button"
              className="block w-full rounded border bg-white px-3 py-1.5 text-left text-sm hover:bg-amber-100 transition-colors"
              onClick={() => {
                setSimilarWarning(null)
                onCreated(s)
              }}
            >
              <span className="font-medium">{s.name}</span>
              {s.contactPerson && <span className="text-muted-foreground ml-2">— {s.contactPerson}</span>}
              {s.phone && <span className="text-muted-foreground ml-2">({s.phone})</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSimilarWarning(null)}
          >
            Create new anyway
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-lg border bg-card p-3 space-y-3">
      <p className="text-sm font-medium">New supplier</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" autoFocus />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Contact person</Label>
          <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255…" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" type="email" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      {error && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Create supplier
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
