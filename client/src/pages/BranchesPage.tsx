import { useCallback, useEffect, useState } from 'react'
import { Building2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import {
  activateBranch,
  createBranch,
  deactivateBranch,
  listBranches,
  updateBranch,
} from '@/services/branch.service'
import type { AdminBranch } from '@/types/admin'

interface BranchForm {
  name: string
  code: string
  address: string
  phone: string
  email: string
}

const emptyForm: BranchForm = { name: '', code: '', address: '', phone: '', email: '' }

export function BranchesPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('branch.create')
  const canEdit = hasPermission('branch.edit')

  const [branches, setBranches] = useState<AdminBranch[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminBranch | null>(null)
  const [form, setForm] = useState<BranchForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deactivating, setDeactivating] = useState<AdminBranch | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBranches(await listBranches())
    } catch {
      toast.error('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(b: AdminBranch) {
    setEditing(b)
    setForm({
      name: b.name,
      code: b.code,
      address: b.address ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateBranch(editing.id, {
          name: form.name,
          code: form.code,
          address: form.address || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
        })
        toast.success('Branch updated')
      } else {
        await createBranch({
          name: form.name,
          code: form.code,
          address: form.address || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
        })
        toast.success('Branch created')
      }
      setFormOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save branch')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return
    try {
      if (deactivating.status === 'ACTIVE') {
        await deactivateBranch(deactivating.id)
        toast.success('Branch deactivated')
      } else {
        await activateBranch(deactivating.id)
        toast.success('Branch activated')
      }
      setDeactivating(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description={`${branches.length} branch${branches.length === 1 ? '' : 'es'} registered`}
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus /> Add branch
            </Button>
          ) : null
        }
      />

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No branches"
            description="Create branches to organize users and inventory by location."
            action={
              canCreate ? (
                <Button onClick={openCreate}>
                  <Plus /> Add branch
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell>{b.address ?? '—'}</TableCell>
                  <TableCell className="text-right">{b._count?.users ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {b.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                          <Pencil className="size-3" /> Edit
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => setDeactivating(b)}>
                          {b.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Branch' : 'Create Branch'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update branch details below.' : 'Add a new branch location.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="bName">Name *</Label>
              <Input
                id="bName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bCode">Code *</Label>
              <Input
                id="bCode"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bAddress">Address</Label>
              <Input
                id="bAddress"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bPhone">Phone</Label>
                <Input
                  id="bPhone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bEmail">Email</Label>
                <Input
                  id="bEmail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate / Activate Confirm */}
      <Dialog open={deactivating !== null} onOpenChange={(open) => { if (!open) setDeactivating(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deactivating?.status === 'ACTIVE' ? 'Deactivate Branch' : 'Activate Branch'}
            </DialogTitle>
            <DialogDescription>
              {deactivating?.status === 'ACTIVE'
                ? `Are you sure you want to deactivate "${deactivating?.name}"? Users assigned to this branch may be affected.`
                : `Are you sure you want to activate "${deactivating?.name}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivating(null)}>Cancel</Button>
            <Button variant={deactivating?.status === 'ACTIVE' ? 'destructive' : 'default'} onClick={() => void handleDeactivate()}>
              {deactivating?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
