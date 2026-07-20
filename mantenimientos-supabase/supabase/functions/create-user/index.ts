// supabase/functions/create-user/index.ts
//
// Edge Function que crea un usuario nuevo (auth + profile) usando la
// Service Role Key. NUNCA expongas esa key en el frontend: por eso esta
// lógica vive en un Edge Function, y solo la puede invocar un usuario
// autenticado cuyo perfil sea 'superadmin' o 'admin' (validado aquí mismo).
//
// Despliegue:
//   supabase functions deploy create-user
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxxx (normalmente ya está
//     disponible automáticamente como variable de entorno del proyecto)

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autorizado' }, 401)
    }

    // Cliente "de contexto" para validar quién llama (usa el JWT del caller)
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !callerUser) return json({ error: 'No autorizado' }, 401)

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('rol, ciudad_id')
      .eq('id', callerUser.id)
      .single()

    if (!callerProfile || !['superadmin', 'admin'].includes(callerProfile.rol)) {
      return json({ error: 'No tienes permisos para crear usuarios' }, 403)
    }

    const body = await req.json()
    const { email, password, nombre, rol, ciudad_id, agencias } = body

    if (!email || !password || !rol) {
      return json({ error: 'email, password y rol son obligatorios' }, 400)
    }

    // Un 'admin' solo puede crear usuarios dentro de SU ciudad y nunca superadmin
    if (callerProfile.rol === 'admin') {
      if (rol === 'superadmin') {
        return json({ error: 'Un admin no puede crear superadmins' }, 403)
      }
      if (ciudad_id !== callerProfile.ciudad_id) {
        return json({ error: 'Un admin solo puede crear usuarios de su propia ciudad' }, 403)
      }
    }

    // Cliente admin (service role) para crear el usuario en auth.users
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol },
    })

    if (createError) return json({ error: createError.message }, 400)

    // El trigger handle_new_user ya creó una fila básica en profiles;
    // aquí la completamos con rol/ciudad/agencias definitivos.
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        nombre: nombre ?? '',
        rol,
        ciudad_id: ciudad_id ?? null,
        agencias: agencias ?? [],
      })
      .eq('id', created.user.id)

    if (updateError) return json({ error: updateError.message }, 400)

    return json({ success: true, user_id: created.user.id }, 200)
  } catch (err) {
    return json({ error: err.message ?? 'Error inesperado' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
