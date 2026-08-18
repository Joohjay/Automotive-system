export interface AdminUser {
  id: string
  email: string
  fullName: string
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  lastLoginAt: string | null
  createdAt: string
  role: { id: string; name: string; code: string }
  branch: { id: string; name: string; code: string }
}

export interface AdminBranch {
  id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  email: string | null
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  _count?: { users: number }
}

export interface Role {
  id: string
  name: string
}
