# Mantenimientos Preventivos — Migración a React + Supabase

Migra tu dashboard (HTML/localStorage) a una app multi-ciudad, multi-usuario
con 3 roles: `superadmin`, `admin`, `tecnico`.

## 1. Crear el proyecto en Supabase

1. Crea un proyecto en https://supabase.com.
2. En **SQL Editor**, ejecuta en orden los archivos de `/sql`:
   1. `001_schema.sql` — tablas: cities, agencies, profiles, equipment_items, maintenance_schedule
   2. `002_rls_policies.sql` — políticas RLS por rol
   3. `003_notifications.sql` — tabla de notificaciones, triggers, Realtime
   4. `004_seed_data.sql` — migra tus datos actuales (KIA FUTURA, HONDA MOTOS, BODEGA, HONDA AUTOS)
   5. `005_rpc.sql` — funciones para marcar/desmarcar mantenimientos de forma atómica
3. En **Database > Extensions**, activa `pg_cron` si quieres recordatorios automáticos
   (ver el comentario al final de `003_notifications.sql`).
4. En **Database > Replication**, confirma que la tabla `notifications` esté
   en la publicación `supabase_realtime` (el script ya la agrega, pero revísalo).

## 2. Crear tu primer superadmin

1. Regístralo normalmente (desde el Login de la app, o desde
   **Authentication > Users > Add user** en Supabase Studio).
2. Luego, en el SQL Editor:
   ```sql
   update public.profiles set rol = 'superadmin', ciudad_id = null, agencias = '{}'
   where email = 'tu_correo@empresa.com';
   ```
3. Con ese superadmin ya puedes entrar a **/admin/usuarios** y crear a los
   demás (admins y técnicos) desde la interfaz — sin tocar SQL.

## 3. Desplegar el Edge Function de creación de usuarios

El panel de superadmin llama a una Edge Function (`create-user`) porque crear
usuarios en `auth.users` requiere la **service role key**, que nunca debe
vivir en el frontend.

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF
supabase functions deploy create-user
```

La función ya recibe `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de forma
automática como variables de entorno del proyecto.

## 4. Configurar y correr el frontend

```bash
npm install
cp .env.example .env
# Edita .env con tu VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
# (Project Settings > API en Supabase Studio)
npm run dev
```

## 5. Cómo quedó organizado el código

```
src/
  lib/supabaseClient.js        Cliente de Supabase (usa variables VITE_*)
  contexts/AuthContext.jsx     Sesión + perfil (rol, ciudad, agencias) global
  components/
    ProtectedRoute.jsx         Redirige a /login o bloquea por rol
    NotificationBell.jsx       Campanita con Supabase Realtime
  hooks/
    useAgencies.js             Agencias + equipos (ya filtrados por RLS)
    useMaintenanceSchedule.js  Mantenimientos agendados (RLS + RPC atómico)
  pages/
    Login.jsx                  Login → redirige según rol
    DashboardPage.jsx          Dashboard migrado (KPIs, tabs, tabla, agenda)
    SuperAdminPanel.jsx        Alta de usuarios (superadmin y admin)
  App.jsx                      Rutas protegidas por rol
supabase/functions/create-user/index.ts   Edge Function (Admin API)
sql/                           Scripts SQL en orden de ejecución
```

## 6. Cómo funciona el control de acceso, en corto

- **Nunca confíes en el frontend para seguridad**: todo el filtrado real pasa
  por RLS en Postgres. Aunque alguien manipule el frontend, Supabase rechaza
  cualquier consulta fuera de su alcance.
- `profiles.rol` define el nivel. `profiles.ciudad_id` acota al `admin` a su
  ciudad. `profiles.agencias` (array de IDs) acota al `tecnico` a agencias
  específicas; para `admin` es opcional (si está vacío, ve toda su ciudad).
- La función `has_agency_access(agency_id)` centraliza esa lógica y la usan
  todas las policies de `equipment_items` y `maintenance_schedule`.
- Marcar un mantenimiento como completado (que suma al conteo de "realizado")
  se hace con la función `toggle_schedule_complete`, no desde el cliente
  directamente — así dos usuarios no pueden pisarse la suma al mismo tiempo.

## 7. Exportar a Excel / PowerPoint

Tu lógica original de `exportToExcel()` y `exportToPPTX()` (SheetJS y
PptxGenJS) se puede reutilizar casi tal cual: simplemente arma el mismo
`state`-como-objeto a partir de `agencies` (del hook `useAgencies`) antes de
llamarlas. No requieren cambios en Supabase.

## 8. Notificaciones en tiempo real — flujo

1. Se crea/reasigna un `maintenance_schedule` con `responsable_id`.
2. El trigger `notify_on_schedule_assignment` inserta una fila en
   `notifications` para ese técnico.
3. El componente `NotificationBell` está suscrito por Realtime a
   `INSERT` en `notifications` filtrado por su propio `user_id`; al llegar,
   actualiza el contador y muestra un aviso emergente.
4. Opcional: activa `pg_cron` + `check_upcoming_maintenance()` para
   recordatorios automáticos diarios de fechas próximas a vencer.
