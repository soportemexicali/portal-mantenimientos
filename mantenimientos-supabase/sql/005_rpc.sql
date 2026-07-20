-- ============================================================================
-- 005_rpc.sql
-- Funciones RPC que replican la lógica de applyMaintenanceToEquipment /
-- reverseMaintenanceFromEquipment del dashboard original, pero de forma
-- atómica en el servidor (evita condiciones de carrera entre usuarios).
-- SECURITY INVOKER: corre con los permisos del usuario que llama, así que
-- RLS de equipment_items / maintenance_schedule sigue aplicando.
-- ============================================================================

create or replace function public.toggle_schedule_complete(p_schedule_id uuid)
returns public.maintenance_schedule
language plpgsql security invoker set search_path = public as $$
declare
  v_schedule public.maintenance_schedule;
  v_item public.equipment_items;
  v_before integer;
begin
  select * into v_schedule from public.maintenance_schedule where id = p_schedule_id;
  if not found then
    raise exception 'Mantenimiento programado no encontrado';
  end if;

  if not public.has_agency_access(v_schedule.agency_id) then
    raise exception 'No tienes acceso a esta agencia';
  end if;

  if v_schedule.completado = false then
    -- Marcar como completado: sumar al equipo (crear el depto si no existe)
    select * into v_item from public.equipment_items
      where agency_id = v_schedule.agency_id and dept = v_schedule.dept;

    if not found then
      insert into public.equipment_items (agency_id, dept, comp, done)
      values (v_schedule.agency_id, v_schedule.dept, v_schedule.cantidad, 0)
      returning * into v_item;
    end if;

    v_before := v_item.done;
    update public.equipment_items
      set done = least(comp, done + v_schedule.cantidad)
      where id = v_item.id
      returning * into v_item;

    update public.maintenance_schedule
      set completado = true, applied_amount = v_item.done - v_before
      where id = p_schedule_id
      returning * into v_schedule;
  else
    -- Desmarcar: revertir lo aplicado
    update public.equipment_items
      set done = greatest(0, done - v_schedule.applied_amount)
      where agency_id = v_schedule.agency_id and dept = v_schedule.dept;

    update public.maintenance_schedule
      set completado = false, applied_amount = 0
      where id = p_schedule_id
      returning * into v_schedule;
  end if;

  return v_schedule;
end;
$$;

create or replace function public.delete_schedule_and_reverse(p_schedule_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_schedule public.maintenance_schedule;
begin
  select * into v_schedule from public.maintenance_schedule where id = p_schedule_id;
  if not found then
    return;
  end if;

  if not public.has_agency_access(v_schedule.agency_id) then
    raise exception 'No tienes acceso a esta agencia';
  end if;

  if v_schedule.completado and v_schedule.applied_amount > 0 then
    update public.equipment_items
      set done = greatest(0, done - v_schedule.applied_amount)
      where agency_id = v_schedule.agency_id and dept = v_schedule.dept;
  end if;

  delete from public.maintenance_schedule where id = p_schedule_id;
end;
$$;

grant execute on function public.toggle_schedule_complete(uuid) to authenticated;
grant execute on function public.delete_schedule_and_reverse(uuid) to authenticated;
