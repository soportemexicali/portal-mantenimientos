-- ============================================================================
-- 001_schema.sql
-- Esquema base: perfiles, ciudades, agencias, equipos y mantenimientos
-- Ejecutar en el SQL Editor de Supabase, en este orden (001, 002, 003)
-- ============================================================================

-- Extensión necesaria para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) CIUDADES
-- ----------------------------------------------------------------------------
create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2) AGENCIAS (antes eran las claves honda/toyota/hyundai/chevrolet en BASELINE_DATA)
-- ----------------------------------------------------------------------------
create table if not exists public.agencies (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,         -- ej. 'kia_futura_mxl'
  title       text not null,                -- ej. 'KIA FUTURA MEXICALI'
  color       text not null default '#6366f1',
  city_id     uuid not null references public.cities(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create index if not exists idx_agencies_city on public.agencies(city_id);

-- ----------------------------------------------------------------------------
-- 3) PERFILES (1:1 con auth.users)
--    rol:      'superadmin' | 'admin' | 'tecnico'
--    ciudad:   ciudad asignada (admin/tecnico). NULL para superadmin (ve todas).
--    agencias: lista de agency_id permitidas. Si es NULL o vacío para un
--               'admin', se interpreta como "todas las agencias de su ciudad".
--               Para 'tecnico' SIEMPRE debe tener al menos una agencia explícita.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  nombre        text not null default '',
  rol           text not null default 'tecnico'
                  check (rol in ('superadmin', 'admin', 'tecnico')),
  ciudad_id     uuid references public.cities(id) on delete set null,
  agencias      uuid[] not null default '{}',   -- array de agencies.id permitidas
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_rol on public.profiles(rol);
create index if not exists idx_profiles_ciudad on public.profiles(ciudad_id);

-- Trigger para mantener updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crear perfil automáticamente cuando se registra un usuario en auth.users
-- (rol por defecto 'tecnico'; el superadmin lo ajusta después desde el panel)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'tecnico')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4) EQUIPOS / DEPARTAMENTOS (reemplaza agency.items[] del dashboard actual)
-- ----------------------------------------------------------------------------
create table if not exists public.equipment_items (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  dept        text not null,
  comp        integer not null default 0 check (comp >= 0),
  done        integer not null default 0 check (done >= 0 and done <= comp),
  updated_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agency_id, dept)
);

create index if not exists idx_equipment_agency on public.equipment_items(agency_id);

drop trigger if exists trg_equipment_updated_at on public.equipment_items;
create trigger trg_equipment_updated_at
  before update on public.equipment_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5) MANTENIMIENTOS PROGRAMADOS (reemplaza scheduleState)
-- ----------------------------------------------------------------------------
create table if not exists public.maintenance_schedule (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  dept            text not null,
  fecha           date not null,
  responsable     text not null default '',
  responsable_id  uuid references public.profiles(id),   -- técnico asignado (opcional)
  cantidad        integer not null default 1 check (cantidad > 0),
  prioridad       text not null default 'media' check (prioridad in ('baja','media','alta')),
  notas           text not null default '',
  completado      boolean not null default false,
  applied_amount  integer not null default 0,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_schedule_agency on public.maintenance_schedule(agency_id);
create index if not exists idx_schedule_responsable on public.maintenance_schedule(responsable_id);
create index if not exists idx_schedule_fecha on public.maintenance_schedule(fecha);

drop trigger if exists trg_schedule_updated_at on public.maintenance_schedule;
create trigger trg_schedule_updated_at
  before update on public.maintenance_schedule
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6) FUNCIONES AUXILIARES (SECURITY DEFINER para evitar recursión en RLS)
-- ----------------------------------------------------------------------------
create or replace function public.current_role_() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.profiles where id = auth.uid();
$$;

create or replace function public.current_ciudad_() returns uuid
language sql stable security definer set search_path = public as $$
  select ciudad_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_agencias_() returns uuid[]
language sql stable security definer set search_path = public as $$
  select agencias from public.profiles where id = auth.uid();
$$;

-- Devuelve true si el usuario actual tiene acceso a una agencia dada,
-- según su rol, ciudad y lista explícita de agencias permitidas.
create or replace function public.has_agency_access(target_agency_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text := public.current_role_();
  v_ciudad uuid := public.current_ciudad_();
  v_agencias uuid[] := public.current_agencias_();
  v_agency_city uuid;
begin
  if v_role = 'superadmin' then
    return true;
  end if;

  select city_id into v_agency_city from public.agencies where id = target_agency_id;

  if v_role = 'admin' then
    -- admin: acceso si la agencia está en su ciudad, y (si tiene lista
    -- explícita de agencias) además debe estar en esa lista
    if v_agency_city is distinct from v_ciudad then
      return false;
    end if;
    if array_length(v_agencias, 1) is null then
      return true; -- sin restricción explícita = toda su ciudad
    end if;
    return target_agency_id = any(v_agencias);
  end if;

  if v_role = 'tecnico' then
    return target_agency_id = any(v_agencias);
  end if;

  return false;
end;
$$;
