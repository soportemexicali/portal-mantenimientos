import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// allowedRoles = undefined -> cualquier usuario autenticado puede entrar
export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Cargando…</div>
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
