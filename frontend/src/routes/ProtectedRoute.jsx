import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute() {
  const { isAuthenticated, isGuestMode } = useAuth()

  if (!isAuthenticated && !isGuestMode) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
