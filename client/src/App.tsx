import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { ReceivingPage } from '@/pages/ReceivingPage'
import { PosPage } from '@/pages/PosPage'
import { SalesPage } from '@/pages/SalesPage'
import { ReturnsPage } from '@/pages/ReturnsPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="pos" element={<PosPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="receiving" element={<ReceivingPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="returns" element={<ReturnsPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route
                path="expenses"
                element={<PlaceholderPage title="Expenses" description="Operational costs and expense categories." />}
              />
              <Route
                path="loans"
                element={<PlaceholderPage title="Loans" description="Funding sources, lending and loan repayment." />}
              />
              <Route
                path="reports"
                element={<PlaceholderPage title="Reports" description="Sales, stock and credit analytics." />}
              />
              <Route
                path="shifts"
                element={<PlaceholderPage title="Shifts" description="Cashier shift management." />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </ErrorBoundary>
    </AuthProvider>
  )
}