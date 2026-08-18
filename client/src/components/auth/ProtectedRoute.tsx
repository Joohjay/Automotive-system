import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { FullPageLoader } from '@/components/ui/full-page-loader'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (mustChangePassword && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />
  }
  return <Outlet />
}

export function RequirePermission({ permission }: { permission: string }) {
  const { hasPermission, isLoading } = useAuth()
  if (isLoading) return <FullPageLoader />
  if (!hasPermission(permission)) return <Navigate to="/" replace />
  return <Outlet />
}