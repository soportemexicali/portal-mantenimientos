import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SuperAdminPanel from './pages/SuperAdminPanel'
import DashboardPage from './pages/DashboardPage' // ver README: envuelve tu dashboard existente
import NotificationBell from './components/NotificationBell'

function TopBar() {
  const { profile, signOut } = useAuth()
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {profile?.nombre} <span className="text-slate-300">·</span>{' '}
          <span className="capitalize font-semibold text-slate-800">{profile?.rol}</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button onClick={signOut} className="text-xs font-semibold text-slate-500 hover:text-red-600 transition">
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'tecnico']}>
            <TopBar />
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/usuarios"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
            <TopBar />
            <SuperAdminPanel />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
