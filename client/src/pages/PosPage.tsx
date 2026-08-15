import { useCallback, useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Receipt, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { listCustomers } from '@/services/customer.service'
import { listProducts } from '@/services/product.service'
import { getSale } from '@/services/sale.service'
import type { Customer } from '@/types/customer'
import type { Product } from '@/types/product'
import type { Sale, SaleDetail } from '@/types/sale'
import { PaymentDialog, type CartLine } from '@/components/pos/PaymentDialog'
import { ReceiptDialog } from '@/components/pos/ReceiptDialog'

export function PosPage() {
  const { hasPermission, settings } = useAuth()
  const currency = settings?.currency ?? 'TZS'
  const canSell = hasPermission('sale.create')

  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [receipt, setReceipt] = useState<SaleDetail | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listProducts({ search: debouncedSearch || undefined, status: 'ACTIVE', pageSize: 50 })
      setProducts(res.data)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const loadCustomers = useCallback(async () => {
    try {
      const res = await listCustomers({ pageSize: 100 })
      setCustomers(res.data)
    } catch {
      // Optional: credit customers load silently.
    }
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const inCart = useMemo(() => new Set(cart.map((l) => l.productId)), [cart])

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: Number(product.sellingPrice),
        },
      ]
    })
  }

  function setQty(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId))
      return
    }
    const product = products.find((p) => p.id === productId)
    if (product && product.stock?.quantityOnHand != null && quantity > product.stock.quantityOnHand) {
      toast.error(`Only ${product.stock.quantityOnHand} in stock`)
      return
    }
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)))
  }

  const subtotal = cart.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0)
  const itemCount = cart.reduce((acc, l) => acc + l.quantity, 0)

  async function handlePaid(sale: Sale) {
    try {
      const detail = await getSale(sale.id)
      setReceipt(detail)
      setCart([])
      void loadProducts()
    } catch {
      setReceipt({ ...sale, items: [], payments: [], returns: [] } as unknown as SaleDetail)
      setCart([])
      void loadProducts()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Point of Sale</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Search parts, add them to the cart, then charge cash, M-Pesa or credit.
          </p>
        </div>
        <Badge variant="default">{itemCount} item{itemCount === 1 ? '' : 's'}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Product picker */}
        <div className="space-y-3 lg:col-span-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search by name, SKU or barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No products found"
              description="Try a different search, or add products first."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => {
                const stock = p.stock?.quantityOnHand ?? 0
                const disabled = stock <= 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled || !canSell}
                    onClick={() => addToCart(p)}
                    className="group flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="w-full truncate text-sm font-medium">{p.name}</span>
                    <span className="text-muted-foreground text-xs">{p.sku}</span>
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span className="text-sm font-semibold">{formatMoney(p.sellingPrice, currency)}</span>
                      <Badge
                        variant={disabled ? 'destructive' : stock <= p.minStockLevel ? 'warning' : 'secondary'}
                      >
                        {disabled ? 'Out' : `${stock} in stock`}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {inCart.has(p.id) ? 'In cart' : 'Tap to add'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="flex flex-col rounded-xl border bg-card lg:sticky lg:top-4 lg:self-start">
          <div className="border-b px-4 py-3">
            <h2 className="flex items-center gap-2 font-medium">
              <ShoppingCart className="size-4" /> Current sale
            </h2>
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <ShoppingCart className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">The cart is empty.</p>
              <p className="text-muted-foreground text-xs">Tap a product to add it.</p>
            </div>
          ) : (
            <>
              <div className="max-h-80 divide-y overflow-y-auto">
                {cart.map((l) => (
                  <div key={l.productId} className="flex items-center gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-muted-foreground text-xs">{l.sku}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setQty(l.productId, l.quantity - 1)}
                        >
                          <Minus />
                        </Button>
                        <span className="w-8 text-center text-sm">{l.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setQty(l.productId, l.quantity + 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Input
                        className="h-8 w-24 text-right"
                        type="number"
                        min="0"
                        step="any"
                        value={l.unitPrice}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((x) =>
                              x.productId === l.productId
                                ? { ...x, unitPrice: Number(e.target.value) || 0 }
                                : x,
                            ),
                          )
                        }
                      />
                      <span className="text-sm font-medium">
                        {formatMoney(l.quantity * l.unitPrice, currency)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setCart((prev) => prev.filter((x) => x.productId !== l.productId))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border-t px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatMoney(subtotal, currency)}</span>
                </div>
                <Button
                  className="mt-3 w-full"
                  size="lg"
                  disabled={cart.length === 0 || !canSell}
                  onClick={() => setPaymentOpen(true)}
                >
                  <Receipt /> Charge {formatMoney(subtotal, currency)}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        cart={cart}
        customers={customers}
        onPaid={(sale) => void handlePaid(sale)}
      />

      <ReceiptDialog sale={receipt} open={receipt !== null} onOpenChange={(open) => !open && setReceipt(null)} />
    </div>
  )
}
