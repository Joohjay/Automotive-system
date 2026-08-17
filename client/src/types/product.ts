export interface Category {
  id: string
  name: string
  description: string | null
  isActive: boolean
  _count?: { products: number }
}

export interface Brand {
  id: string
  name: string
  description: string | null
  isActive: boolean
  _count?: { products: number }
}

export interface StorageLocation {
  id: string
  branchId: string
  code: string
  name: string
  type: string
  description: string | null
  isActive: boolean
}

export interface ProductStock {
  quantityOnHand: number
  locationCode: string | null
  locationName: string | null
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE'

export interface Product {
  id: string
  name: string
  sku: string
  partNumber: string | null
  description: string | null
  compatibility: string | null
  purchasePrice: string
  sellingPrice: string
  minStockLevel: number
  reorderQty: number
  unitOfMeasure: string
  barcode: string | null
  status: ProductStatus
  createdAt: string
  updatedAt: string
  category: { id: string; name: string } | null
  brand: { id: string; name: string } | null
  stock: ProductStock
}

export interface Paginated<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    pages: number
  }
}

export interface ProductCreateInput {
  name: string
  sku: string
  partNumber?: string | null
  categoryId: string
  brandId?: string | null
  description?: string | null
  compatibility?: string | null
  purchasePrice: string | number
  sellingPrice: string | number
  minStockLevel: number
  reorderQty: number
  unitOfMeasure: string
  barcode?: string | null
  status: ProductStatus
}

export type ProductUpdateInput = Partial<ProductCreateInput>

export interface ProductQuery {
  search?: string
  categoryId?: string
  brandId?: string
  status?: ProductStatus
  page?: number
  pageSize?: number
}