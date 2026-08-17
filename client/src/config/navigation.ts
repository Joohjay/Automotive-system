import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  ClipboardList,
  DollarSign,
  Gauge,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Undo2,
  Users,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  description?: string
  permission?: string
}

/**
 * Central navigation definition for the application shell.
 * Modules are added here as they are implemented in each stage.
 * The optional `permission` field controls visibility per user role.
 */
export const primaryNav: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Gauge, permission: 'dashboard.view' },
  { label: 'Point of Sale', href: '/pos', icon: ShoppingCart, description: 'Sales, receipts, payments', permission: 'sale.create' },
  { label: 'Products', href: '/products', icon: Package, description: 'Parts, categories, brands', permission: 'product.view' },
  { label: 'Inventory', href: '/inventory', icon: Boxes, description: 'Stock, adjustments, ledger', permission: 'inventory.view' },
  { label: 'Stock Receiving', href: '/receiving', icon: Truck, description: 'Purchase orders and stock-in', permission: 'purchase.view' },
  { label: 'Suppliers', href: '/suppliers', icon: ClipboardList, description: 'Vendor records', permission: 'supplier.view' },
  { label: 'Sales', href: '/sales', icon: Receipt, description: 'Sales history and voids', permission: 'sale.view' },
  { label: 'Returns', href: '/returns', icon: Undo2, description: 'Refunds and restocking', permission: 'sale.return' },
  { label: 'Customers', href: '/customers', icon: Users, description: 'Credit accounts and payments', permission: 'customer.view' },
  { label: 'Expenses', href: '/expenses', icon: DollarSign, description: 'Operational costs', permission: 'expense.view' },
  { label: 'Loans', href: '/loans', icon: ClipboardList, description: 'Funding sources and lending', permission: 'loan.view' },
  { label: 'Reports', href: '/reports', icon: Gauge, description: 'Sales and stock analytics', permission: 'report.view' },
  { label: 'Shifts', href: '/shifts', icon: ClipboardList, description: 'Cashier shift management', permission: 'shift.open' },
]

export const upcomingModules: NavItem[] = []
