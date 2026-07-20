import { createClient } from '@supabase/supabase-js'

// Variables de entorno de Vite (crea un archivo .env en la raíz del proyecto):
//   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
//   VITE_SUPABASE_ANON_KEY=tu-anon-key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
