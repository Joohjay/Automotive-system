import { apiRequest } from '@/services/http'
import type {
  Paginated,
  Product,
  ProductCreateInput,
  ProductQuery,
  ProductStatus,
  ProductUpdateInput,
} from '@/types/product'

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listProducts(
  query: ProductQuery = {},
): Promise<Paginated<Product>> {
  return apiRequest<Paginated<Product>>(
    `/products${toQuery({
      search: query.search,
      categoryId: query.categoryId,
      brandId: query.brandId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    })}`,
  )
}

export async function getProduct(id: string): Promise<Product> {
  const res = await apiRequest<{ data: Product }>(`/products/${id}`)
  return res.data
}

export async function createProduct(input: ProductCreateInput): Promise<Product> {
  const res = await apiRequest<{ data: Product }>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function updateProduct(id: string, input: ProductUpdateInput): Promise<Product> {
  const res = await apiRequest<{ data: Product }>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

export async function setProductStatus(id: string, status: ProductStatus): Promise<Product> {
  const res = await apiRequest<{ data: Product }>(`/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return res.data
}