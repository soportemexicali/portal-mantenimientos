-- ============================================================
-- 006_maintenance_logs.sql (Versión corregida para Supabase)
-- Registro de mantenimientos completados con fotos Antes/Después
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bucket de Storage para las fotos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('maintenance-photos', 'maintenance-photos', true)
on conflict (id) do nothing;

-- Eliminar políticas previas de storage si ya existían para evitar conflictos
drop policy if exists "maintenance_photos_insert" on storage.objects;
create policy "maintenance_photos_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'maintenance-photos');

drop policy if exists "maintenance_photos_select" on storage.objects;
create policy "maintenance_photos_select"
on storage.objects for select to public
using (bucket_id = 'maintenance-photos');


-- ------------------------------------------------------------
-- 2. Tabla de registros con fotos
-- ------------------------------------------------------------
create table if not exists public.maintenance_logs (
    id                 uuid primary key default gen_random_uuid(),
    agency_id          uuid not null references public.agencies(id),
    dept               text not null,
    notas              text,
    foto_antes_url     text not null,
    foto_despues_url   text not null,
    cantidad           integer not null default 1,
    created_by         uuid references auth.users(id),
    created_at         timestamptz not null default now()
);

alter table public.maintenance_logs enable row level security;

-- Eliminar y recrear políticas de la tabla maintenance_logs
drop policy if exists maintenance_logs_select on public.maintenance_logs;
create policy maintenance_logs_select
on public.maintenance_logs for select
using (public.has_agency_access(agency_id));

drop policy if exists maintenance_logs_insert on public.maintenance_logs;
create policy maintenance_logs_insert
on public.maintenance_logs for insert
with check (public.has_agency_access(agency_id));


-- ------------------------------------------------------------
-- 3. RPC atómico: registra el log, suma en equipment_items,
--    y completa cualquier pendiente que coincida en la agenda
-- ------------------------------------------------------------
create or replace function public.register_maintenance_with_photos(
    p_agency_id        uuid,
    p_dept             text,
    p_notas            text,
    p_foto_antes       text,
    p_foto_despues     text,
    p_cantidad         integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_log_id   uuid;
    v_item_id  uuid;
    v_comp     integer;
    v_done     integer;
    v_dept     text := upper(trim(p_dept));
begin
    if not public.has_agency_access(p_agency_id) then
        raise exception 'No tienes acceso a esta agencia';
    end if;

    -- 3.1 Insertar el registro con fotos
    insert into public.maintenance_logs
        (agency_id, dept, notas, foto_antes_url, foto_despues_url, cantidad, created_by)
    values
        (p_agency_id, v_dept, p_notas, p_foto_antes, p_foto_despues, p_cantidad, auth.uid())
    returning id into v_log_id;

    -- 3.2 Sumar en equipment_items (crea la fila si el depto no existía)
    select id, comp, done into v_item_id, v_comp, v_done
    from public.equipment_items
    where agency_id = p_agency_id and dept = v_dept;

    if v_item_id is null then
        insert into public.equipment_items (agency_id, dept, comp, done)
        values (p_agency_id, v_dept, p_cantidad, p_cantidad);
    else
        update public.equipment_items
        set done = least(comp, done + p_cantidad)
        where id = v_item_id;
    end if;

    -- 3.3 Si había un pendiente agendado para esa agencia+depto, completarlo
    update public.maintenance_schedule
    set completado = true
    where agency_id = p_agency_id
      and dept = v_dept
      and completado = false;

    return v_log_id;
end;
$$;