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
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { getPurchase, receivePurchase } from '@/services/purchase.service'
import { listLocations, createLocation } from '@/services/referenceData.service'
import type { PurchaseDetail } from '@/types/purchase'
import type { StorageLocation } from '@/types/product'

export function ReceiveDialog({
  purchaseId,
  open,
  onOpenChange,
  onDone,
}: {
  purchaseId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null)
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [locationId, setLocationId] = useState('')
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationCode, setNewLocationCode] = useState('')
  const [newLocationName, setNewLocationName] = useState('')

  useEffect(() => {
    if (!open || !purchaseId) return
    setError(null)
    setSaving(false)
    setPurchase(null)
    setLoading(true)
    setShowNewLocation(false)
    void (async () => {
      try {
        const [p, locs] = await Promise.all([getPurchase(purchaseId), listLocations()])
        setPurchase(p)
        setLocations(locs)
        setLocationId(locs[0]?.id ?? '')
        const defaults: Record<string, string> = {}
        for (const item of p.items) {
          const remaining = item.quantity - item.receivedQty
          if (remaining > 0) defaults[item.id] = String(remaining)
        }
        setQtyByItem(defaults)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load purchase order.')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, purchaseId])

  const itemsToReceive = (purchase?.items ?? []).filter((i) => {
    const qty = Number(qtyByItem[i.id]) || 0
    return qty > 0
  })
  const outstanding = (purchase?.items ?? []).filter((i) => i.quantity - i.receivedQty > 0)

  async function searchLocations(q: string): Promise<SearchableOption[]> {
    try {
      const locs = locations.length > 0 ? locations : await listLocations()
      if (locations.length === 0) setLocations(locs)
      const lowerQ = q.toLowerCase()
      return locs
        .filter((l) => l.code.toLowerCase().includes(lowerQ) || l.name.toLowerCase().includes(lowerQ))
        .map((l) => ({
          id: l.id,
          label: `${l.code} — ${l.name}`,
          sublabel: l.type || undefined,
        }))
    } catch { return [] }
  }

  async function handleCreateLocation(code: string) {
    setNewLocationCode(code)
    setNewLocationName(code)
    setShowNewLocation(true)
  }

  async function doCreateLocation() {
    if (!newLocationCode.trim()) return
    try {
      const loc = await createLocation({
        code: newLocationCode.trim().toUpperCase(),
        name: newLocationName.trim() || newLocationCode.trim(),
        type: 'AREA',
      })
      setLocations((prev) => [...prev, loc])
      setLocationId(loc.id)
      setShowNewLocation(false)
      toast.success(`Location "${loc.code}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create location')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!purchase || !locationId) { setError('Select a storage location.'); return }
    if (itemsToReceive.length === 0) { setError('Enter a quantity for at least one item.'); return }

    for (const item of itemsToReceive) {
      const remaining = item.quantity - item.receivedQty
      const qty = Number(qtyByItem[item.id]) || 0
      if (qty > remaining) {
        setError(`Receiving ${qty} exceeds the remaining ${remaining} for "${item.product?.name}".`)
        return
      }
    }

    setSaving(true)
    try {
      await receivePurchase(purchase.id, {
        locationId,
        items: itemsToReceive.map((i) => ({ itemId: i.id, quantity: Number(qtyByItem[i.id]) })),
      })
      toast.success('Goods received into stock')
      onDone()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receiving failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Receive goods{purchase ? ` — ${purchase.reference}` : ''}
          </DialogTitle>
          <DialogDescription>
            Stock enters the ledger here. Enter what actually arrived for each item.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin" />
          </div>
        ) : !purchase ? null : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Storage location *</Label>
              {showNewLocation ? (
                <div className="flex items-end gap-2 rounded-lg border bg-card p-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Location code</Label>
                    <Input
                      value={newLocationCode}
                      onChange={(e) => setNewLocationCode(e.target.value)}
                      placeholder="e.g. RACK-A"
                      autoFocus
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Location name</Label>
                    <Input
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="e.g. Rack A"
                    />
                  </div>
                  <Button type="button" size="sm" onClick={() => void doCreateLocation()}>Save</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewLocation(false)}>Cancel</Button>
                </div>
              ) : (
                <SearchableSelect
                  value={locationId}
                  onChange={setLocationId}
                  onSearch={searchLocations}
                  onCreateNew={handleCreateLocation}
                  placeholder="Search location by code or name…"
                  createNewLabel="Add new location"
                />
              )}
            </div>

            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Ordered</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="px-3 py-2 text-right font-medium">Remaining</th>
                    <th className="px-3 py-2 text-right font-medium">Receiving now</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => {
                    const remaining = item.quantity - item.receivedQty
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">
                          {item.product?.name}
                          <span className="text-muted-foreground text-xs"> ({item.product?.sku})</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.receivedQty}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{remaining}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            className="ml-auto h-8 w-20 text-right tabular-nums"
                            type="number"
                            min="0"
                            max={remaining}
                            value={qtyByItem[item.id] ?? ''}
                            onChange={(e) =>
                              setQtyByItem((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {outstanding.length === 0 ? (
              <p className="text-muted-foreground text-xs">Everything has already been received.</p>
            ) : null}
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || outstanding.length === 0}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Receive into stock
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
