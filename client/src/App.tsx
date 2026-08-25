import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RequirePermission } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { ReceivingPage } from '@/pages/ReceivingPage'
import { PosPage } from '@/pages/PosPage'
import { SalesPage } from '@/pages/SalesPage'
import { ReturnsPage } from '@/pages/ReturnsPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { LoansPage } from '@/pages/LoansPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ProfitLossPage } from '@/pages/ProfitLossPage'
import { ShiftsPage } from '@/pages/ShiftsPage'
import { UsersPage } from '@/pages/UsersPage'
import { BranchesPage } from '@/pages/BranchesPage'
import { AccountPage } from '@/pages/AccountPage'
import { ForcePasswordChangePage } from '@/pages/ForcePasswordChangePage'
import { MfaVerifyPage } from '@/pages/MfaVerifyPage'

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mfa-verify" element={<MfaVerifyPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="force-password-change" element={<ForcePasswordChangePage />} />
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route element={<RequirePermission permission="sale.create" />}>
                <Route path="pos" element={<PosPage />} />
              </Route>
              <Route element={<RequirePermission permission="product.view" />}>
                <Route path="products" element={<ProductsPage />} />
              </Route>
              <Route element={<RequirePermission permission="inventory.view" />}>
                <Route path="inventory" element={<InventoryPage />} />
              </Route>
              <Route element={<RequirePermission permission="purchase.view" />}>
                <Route path="receiving" element={<ReceivingPage />} />
              </Route>
              <Route element={<RequirePermission permission="supplier.view" />}>
                <Route path="suppliers" element={<SuppliersPage />} />
              </Route>
              <Route element={<RequirePermission permission="sale.view" />}>
                <Route path="sales" element={<SalesPage />} />
              </Route>
              <Route element={<RequirePermission permission="sale.return" />}>
                <Route path="returns" element={<ReturnsPage />} />
              </Route>
              <Route element={<RequirePermission permission="customer.view" />}>
                <Route path="customers" element={<CustomersPage />} />
              </Route>
              <Route element={<RequirePermission permission="expense.view" />}>
                <Route path="expenses" element={<ExpensesPage />} />
              </Route>
              <Route element={<RequirePermission permission="loan.view" />}>
                <Route path="loans" element={<LoansPage />} />
              </Route>
              <Route element={<RequirePermission permission="report.view" />}>
                <Route path="reports" element={<ReportsPage />} />
              </Route>
              <Route element={<RequirePermission permission="report.view" />}>
                <Route path="pnl" element={<ProfitLossPage />} />
              </Route>
              <Route element={<RequirePermission permission="shift.open" />}>
                <Route path="shifts" element={<ShiftsPage />} />
              </Route>
              <Route path="account" element={<AccountPage />} />
              <Route element={<RequirePermission permission="user.view" />}>
                <Route path="admin/users" element={<UsersPage />} />
              </Route>
              <Route element={<RequirePermission permission="branch.view" />}>
                <Route path="admin/branches" element={<BranchesPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </ErrorBoundary>
    </AuthProvider>
  )
}
