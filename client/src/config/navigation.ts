import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  ClipboardList,
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
}

/**
 * Central navigation definition for the application shell.
 * Modules are added here as they are implemented in each stage.
 */
export const primaryNav: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Gauge },
  { label: 'Point of Sale', href: '/pos', icon: ShoppingCart, description: 'Sales, receipts, payments' },
  { label: 'Products', href: '/products', icon: Package, description: 'Parts, categories, brands' },
  { label: 'Inventory', href: '/inventory', icon: Boxes, description: 'Stock, adjustments, ledger' },
  { label: 'Stock Receiving', href: '/receiving', icon: Truck, description: 'Purchase orders and stock-in' },
  { label: 'Suppliers', href: '/suppliers', icon: ClipboardList, description: 'Vendor records' },
  { label: 'Sales', href: '/sales', icon: Receipt, description: 'Sales history and voids' },
  { label: 'Returns', href: '/returns', icon: Undo2, description: 'Refunds and restocking' },
  { label: 'Customers', href: '/customers', icon: Users, description: 'Credit accounts and payments' },
]

export const upcomingModules: NavItem[] = [
  { label: 'Expenses', href: '/expenses', icon: ClipboardList, description: 'Operational costs' },
  { label: 'Loans', href: '/loans', icon: Gauge, description: 'Funding sources and lending' },
  { label: 'Reports', href: '/reports', icon: ClipboardList, description: 'Sales and stock analytics' },
  { label: 'Shifts', href: '/shifts', icon: Gauge, description: 'Cashier shift management' },
]
