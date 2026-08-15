export type SupplierStatus = 'ACTIVE' | 'INACTIVE'

export interface Supplier {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxNumber: string | null
  status: SupplierStatus
  createdAt: string
  updatedAt: string
  _count?: { purchases: number }
}

export interface SupplierInput {
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  status?: SupplierStatus
}