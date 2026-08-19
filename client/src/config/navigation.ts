import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  Building2,
  ClipboardList,
  DollarSign,
  Gauge,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Truck,
  Undo2,
  UserCog,
  Users,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  description?: string
  permission?: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

/**
 * Central navigation definition for the application shell.
 * Modules are grouped into labelled sections for a clear page hierarchy.
 * The optional `permission` field controls visibility per user role.
 */
export const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/', icon: Gauge, permission: 'dashboard.view' }],
  },
  {
    label: 'Operations',
    items: [
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
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', href: '/reports', icon: Gauge, description: 'Sales and stock analytics', permission: 'report.view' },
      { label: 'Profit & Loss', href: '/pnl', icon: TrendingUp, description: 'Revenue, costs, and net profit', permission: 'report.view' },
      { label: 'Shifts', href: '/shifts', icon: ClipboardList, description: 'Cashier shift management', permission: 'shift.open' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', icon: UserCog, description: 'User accounts and roles', permission: 'user.view' },
      { label: 'Branches', href: '/admin/branches', icon: Building2, description: 'Branch management', permission: 'branch.view' },
    ],
  },
]

// Flat list for lookups (e.g. matching the current path in ComingSoonPage).
export const primaryNav: NavItem[] = navSections.flatMap((section) => section.items)

export const upcomingModules: NavItem[] = []