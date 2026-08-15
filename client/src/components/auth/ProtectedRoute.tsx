import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { FullPageLoader } from '@/components/ui/full-page-loader'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function RequirePermission({ permission }: { permission: string }) {
  const { hasPermission, isLoading } = useAuth()
  if (isLoading) return <FullPageLoader />
  if (!hasPermission(permission)) return <Navigate to="/" replace />
  return <Outlet />
}