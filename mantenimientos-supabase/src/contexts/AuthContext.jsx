import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, nombre, rol, ciudad_id, agencias, activo, cities:ciudad_id(nombre)')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error cargando perfil:', error.message)
      setProfile(null)
      return
    }
    setProfile(data)
  }, [])

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        // Obtenemos la sesión inicial de forma síncrona/await para evitar carreras
        const { data: { session } } = await supabase.auth.getSession()
        
        if (mounted) {
          setSession(session)
          if (session?.user) {
            await loadProfile(session.user.id)
          }
        }
      } catch (err) {
        console.error("Error al inicializar sesión:", err)
      } finally {
        if (mounted) {
          setLoading(false) // Solo quitamos el loading una vez que TODO cargó
        }
      }
    }

    initAuth()

    // Suscripción a cambios de sesión (login, logout, refresh de token)
    const { data: { subscription: listener } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      listener?.unsubscribe()
    }
  }, [loadProfile])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    role: profile?.rol ?? null,
    isSuperadmin: profile?.rol === 'superadmin',
    isAdmin: profile?.rol === 'admin',
    isTecnico: profile?.rol === 'tecnico',
    signIn,
    signOut,
    refreshProfile: () => session?.user && loadProfile(session.user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
