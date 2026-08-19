import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, Search, Shield, UserCog } from 'lucide-react'
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
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatDateTime } from '@/lib/format'
import { PASSWORD_HINT, validatePassword } from '@/lib/password'
import {
  adminResetPassword,
  activateUser,
  createUser,
  deactivateUser,
  listRoles,
  listUsers,
  updateUser,
} from '@/services/user.service'
import { listBranches } from '@/services/branch.service'
import type { AdminBranch, AdminUser, Role } from '@/types/admin'

const PAGE_SIZE = 10

interface UserForm {
  email: string
  fullName: string
  phone: string
  roleId: string
  branchId: string
  password: string
}

const emptyForm: UserForm = { email: '', fullName: '', phone: '', roleId: '', branchId: '', password: '' }

export function UsersPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('user.create')
  const canEdit = hasPermission('user.edit')

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [roles, setRoles] = useState<Role[]>([])
  const [branches, setBranches] = useState<AdminBranch[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deactivating, setDeactivating] = useState<AdminUser | null>(null)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listUsers({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setUsers(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, statusFilter])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter])

  useEffect(() => {
    listRoles().then(setRoles).catch(() => {})
    listBranches().then(setBranches).catch(() => {})
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(u: AdminUser) {
    setEditing(u)
    setForm({
      email: u.email,
      fullName: u.fullName,
      phone: u.phone ?? '',
      roleId: u.role.id,
      branchId: u.branch.id,
      password: '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.fullName.trim() || !form.email.trim() || !form.roleId || !form.branchId) {
      toast.error('Please fill all required fields')
      return
    }
    if (!editing && !form.password) {
      toast.error('Password is required for new users')
      return
    }
    if (!editing) {
      const pwError = validatePassword(form.password)
      if (pwError) {
        toast.error(pwError)
        return
      }
    }
    setSaving(true)
    try {
      if (editing) {
        await updateUser(editing.id, {
          email: form.email,
          fullName: form.fullName,
          phone: form.phone || undefined,
          roleId: form.roleId,
          branchId: form.branchId,
        })
        toast.success('User updated')
      } else {
        await createUser({
          email: form.email,
          fullName: form.fullName,
          phone: form.phone || undefined,
          roleId: form.roleId,
          branchId: form.branchId,
          password: form.password,
        })
        toast.success('User created')
      }
      setFormOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return
    try {
      if (deactivating.status === 'ACTIVE') {
        await deactivateUser(deactivating.id)
        toast.success('User deactivated')
      } else {
        await activateUser(deactivating.id)
        toast.success('User activated')
      }
      setDeactivating(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleResetPassword() {
    if (!resetUser) return
    if (!resetPassword) {
      toast.error('Please enter a new password')
      return
    }
    const pwError = validatePassword(resetPassword)
    if (pwError) {
      toast.error(pwError)
      return
    }
    setResetting(true)
    try {
      await adminResetPassword(resetUser.id, resetPassword)
      toast.success(`Password reset. New password emailed to ${resetUser.fullName}.`)
      setResetUser(null)
      setResetPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${total} user${total === 1 ? '' : 's'} registered`}
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus /> Add user
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No users"
            description="Create user accounts to grant team members access to the system."
            action={
              canCreate ? (
                <Button onClick={openCreate}>
                  <Plus /> Add user
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role.name}</Badge>
                  </TableCell>
                  <TableCell>{u.branch.name}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(u.lastLoginAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          <Pencil className="size-3" /> Edit
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivating(u)}
                        >
                          <Shield className="size-3" />
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResetUser(u)
                            setResetPassword('')
                          }}
                        >
                          <KeyRound className="size-3" /> Reset PW
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

      <Pagination page={page} pages={pages} onPageChange={setPage} />

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the user account details below.' : 'Fill in the details to create a new user account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role *</Label>
                <Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Branch *</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing ? (
              <div className="grid gap-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-muted-foreground text-xs">{PASSWORD_HINT}</p>
              </div>
            ) : null}
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
              {deactivating?.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
            </DialogTitle>
            <DialogDescription>
              {deactivating?.status === 'ACTIVE'
                ? `Are you sure you want to deactivate ${deactivating?.fullName}? They will no longer be able to sign in.`
                : `Are you sure you want to activate ${deactivating?.fullName}?`}
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

      {/* Reset Password Dialog */}
      <Dialog open={resetUser !== null} onOpenChange={(open) => { if (!open) { setResetUser(null); setResetPassword('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.fullName} ({resetUser?.email}). The new password will be emailed to them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="resetPw">New Password *</Label>
            <Input
              id="resetPw"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Enter new password"
            />
            <p className="text-muted-foreground text-xs">{PASSWORD_HINT}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetUser(null); setResetPassword('') }}>Cancel</Button>
            <Button onClick={() => void handleResetPassword()} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
