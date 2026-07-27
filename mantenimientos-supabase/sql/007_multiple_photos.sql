-- ============================================================
-- 007_multiple_photos.sql
-- Permite hasta 3 fotos "antes" y hasta 3 "después" por registro
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar las columnas de arreglos
-- ------------------------------------------------------------
alter table public.maintenance_logs
    add column if not exists fotos_antes text[] not null default '{}',
    add column if not exists fotos_despues text[] not null default '{}';

-- ------------------------------------------------------------
-- 2. Migrar los datos existentes (si ya tenías registros con
--    foto_antes_url/foto_despues_url de la versión anterior)
-- ------------------------------------------------------------
update public.maintenance_logs
set fotos_antes = array[foto_antes_url]
where foto_antes_url is not null and fotos_antes = '{}';

update public.maintenance_logs
set fotos_despues = array[foto_despues_url]
where foto_despues_url is not null and fotos_despues = '{}';

-- ------------------------------------------------------------
-- 3. Retirar las columnas viejas (ya migradas arriba)
-- ------------------------------------------------------------
alter table public.maintenance_logs
    drop column if exists foto_antes_url,
    drop column if exists foto_despues_url;

-- ------------------------------------------------------------
-- 4. Reemplazar el RPC para aceptar arreglos (máx. 3 y 3)
-- ------------------------------------------------------------
drop function if exists public.register_maintenance_with_photos(uuid, text, text, text, text, integer);

create or replace function public.register_maintenance_with_photos(
    p_agency_id       uuid,
    p_dept            text,
    p_notas           text,
    p_fotos_antes     text[],
    p_fotos_despues   text[],
    p_cantidad        integer default 1
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

    if array_length(p_fotos_antes, 1) is null or array_length(p_fotos_antes, 1) < 1 then
        raise exception 'Debes adjuntar al menos una foto de "antes"';
    end if;
    if array_length(p_fotos_antes, 1) > 3 or array_length(p_fotos_despues, 1) > 3 then
        raise exception 'Máximo 3 fotos por cada lado (antes/después)';
    end if;

    -- 4.1 Insertar el registro con los arreglos de fotos
    insert into public.maintenance_logs
        (agency_id, dept, notas, fotos_antes, fotos_despues, cantidad, created_by)
    values
        (p_agency_id, v_dept, p_notas, p_fotos_antes, coalesce(p_fotos_despues, '{}'), p_cantidad, auth.uid())
    returning id into v_log_id;

    -- 4.2 Sumar en equipment_items (crea la fila si el depto no existía)
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

    -- 4.3 Completar el pendiente agendado que coincida, si existía
    update public.maintenance_schedule
    set completado = true
    where agency_id = p_agency_id
      and dept = v_dept
      and completado = false;

    return v_log_id;
end;
$$;
