import { apiRequest } from '@/services/http'
import type { Brand, Category, StorageLocation } from '@/types/product'

export async function listCategories(): Promise<Category[]> {
  const res = await apiRequest<{ data: Category[] }>('/reference/categories')
  return res.data
}

export async function createCategory(input: {
  name: string
  description?: string | null
}): Promise<Category> {
  const res = await apiRequest<{ data: Category }>('/reference/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function listBrands(): Promise<Brand[]> {
  const res = await apiRequest<{ data: Brand[] }>('/reference/brands')
  return res.data
}

export async function createBrand(input: { name: string; description?: string | null }): Promise<Brand> {
  const res = await apiRequest<{ data: Brand }>('/reference/brands', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function listLocations(): Promise<StorageLocation[]> {
  const res = await apiRequest<{ data: StorageLocation[] }>('/reference/locations')
  return res.data
}

export async function createLocation(input: {
  code: string
  name: string
  type?: string
}): Promise<StorageLocation> {
  const res = await apiRequest<{ data: StorageLocation }>('/reference/locations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}