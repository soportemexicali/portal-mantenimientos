-- ============================================================================
-- 002_rls_policies.sql
-- Row Level Security para: profiles, cities, agencies, equipment_items,
-- maintenance_schedule
-- ============================================================================

alter table public.cities enable row level security;
alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.equipment_items enable row level security;
alter table public.maintenance_schedule enable row level security;

-- ----------------------------------------------------------------------------
-- CITIES: lectura para cualquier usuario autenticado; escritura solo superadmin
-- ----------------------------------------------------------------------------
drop policy if exists cities_select on public.cities;
create policy cities_select on public.cities
  for select using (auth.role() = 'authenticated');

drop policy if exists cities_write on public.cities;
create policy cities_write on public.cities
  for all using (public.current_role_() = 'superadmin')
  with check (public.current_role_() = 'superadmin');

-- ----------------------------------------------------------------------------
-- AGENCIES
--   select: superadmin ve todas; admin/tecnico ven solo las de su alcance
--   insert/update/delete: superadmin siempre; admin solo dentro de su ciudad
-- ----------------------------------------------------------------------------
drop policy if exists agencies_select on public.agencies;
create policy agencies_select on public.agencies
  for select using (
    public.current_role_() = 'superadmin'
    or city_id = public.current_ciudad_()
  );

drop policy if exists agencies_insert on public.agencies;
create policy agencies_insert on public.agencies
  for insert with check (
    public.current_role_() = 'superadmin'
    or (public.current_role_() = 'admin' and city_id = public.current_ciudad_())
  );

drop policy if exists agencies_update on public.agencies;
create policy agencies_update on public.agencies
  for update using (
    public.current_role_() = 'superadmin'
    or (public.current_role_() = 'admin' and city_id = public.current_ciudad_())
  );

drop policy if exists agencies_delete on public.agencies;
create policy agencies_delete on public.agencies
  for delete using (public.current_role_() = 'superadmin');

-- ----------------------------------------------------------------------------
-- PROFILES
--   select: cada quien ve su propio perfil; admin ve los de su ciudad;
--            superadmin ve todos
--   update: cada quien puede editar campos propios NO sensibles (nombre);
--            el cambio de rol/ciudad/agencias solo lo hace superadmin
--            (se controla también a nivel de aplicación / función RPC)
--   insert: lo maneja el trigger handle_new_user (security definer),
--            pero se deja una policy de respaldo para superadmin/admin
-- ----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.current_role_() = 'superadmin'
    or (public.current_role_() = 'admin' and ciudad_id = public.current_ciudad_())
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (
    public.current_role_() = 'superadmin'
    or (public.current_role_() = 'admin' and ciudad_id = public.current_ciudad_() and rol <> 'superadmin')
  );

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert with check (
    public.current_role_() in ('superadmin', 'admin')
  );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete using (public.current_role_() = 'superadmin');

-- ----------------------------------------------------------------------------
-- EQUIPMENT_ITEMS
--   select/update: según has_agency_access(agency_id)
--   insert: admin/superadmin, o tecnico si tiene acceso a la agencia
--   delete: solo admin/superadmin
-- ----------------------------------------------------------------------------
drop policy if exists equipment_select on public.equipment_items;
create policy equipment_select on public.equipment_items
  for select using (public.has_agency_access(agency_id));

drop policy if exists equipment_insert on public.equipment_items;
create policy equipment_insert on public.equipment_items
  for insert with check (
    public.has_agency_access(agency_id)
    and public.current_role_() in ('superadmin', 'admin', 'tecnico')
  );

drop policy if exists equipment_update on public.equipment_items;
create policy equipment_update on public.equipment_items
  for update using (public.has_agency_access(agency_id))
  with check (public.has_agency_access(agency_id));

drop policy if exists equipment_delete on public.equipment_items;
create policy equipment_delete on public.equipment_items
  for delete using (
    public.has_agency_access(agency_id)
    and public.current_role_() in ('superadmin', 'admin')
  );

-- ----------------------------------------------------------------------------
-- MAINTENANCE_SCHEDULE
--   select: según has_agency_access(agency_id)
--   insert: admin/superadmin de la agencia, o tecnico agendando en su propia
--            agencia asignada
--   update: quien tenga acceso a la agencia (permite a tecnico marcar
--            completado / actualizar su propia tarea); delete solo admin+
-- ----------------------------------------------------------------------------
drop policy if exists schedule_select on public.maintenance_schedule;
create policy schedule_select on public.maintenance_schedule
  for select using (public.has_agency_access(agency_id));

drop policy if exists schedule_insert on public.maintenance_schedule;
create policy schedule_insert on public.maintenance_schedule
  for insert with check (public.has_agency_access(agency_id));

drop policy if exists schedule_update on public.maintenance_schedule;
create policy schedule_update on public.maintenance_schedule
  for update using (public.has_agency_access(agency_id))
  with check (public.has_agency_access(agency_id));

drop policy if exists schedule_delete on public.maintenance_schedule;
create policy schedule_delete on public.maintenance_schedule
  for delete using (
    public.has_agency_access(agency_id)
    and public.current_role_() in ('superadmin', 'admin')
  );
