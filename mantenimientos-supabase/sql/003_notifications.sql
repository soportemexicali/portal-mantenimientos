-- ============================================================================
-- 003_notifications.sql
-- Tabla de notificaciones + RLS + triggers para avisos en tiempo real
-- ============================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mensaje     text not null,
  tipo        text not null default 'info'
                check (tipo in ('info', 'asignacion', 'recordatorio', 'vencido', 'alerta')),
  leida       boolean not null default false,
  metadata    jsonb not null default '{}',   -- ej. { "schedule_id": "...", "agency_id": "..." }
  fecha       timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, leida);
create index if not exists idx_notifications_fecha on public.notifications(fecha desc);

alter table public.notifications enable row level security;

-- Cada usuario solo lee/edita/borra sus propias notificaciones.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid() or public.current_role_() = 'superadmin');

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());

-- Las notificaciones normalmente las crea el backend/trigger (security definer),
-- pero dejamos una policy de inserción para admins/superadmin que quieran
-- notificar manualmente a un usuario de su alcance.
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert with check (
    public.current_role_() in ('superadmin', 'admin')
  );

-- ----------------------------------------------------------------------------
-- TRIGGER 1: Notificar al técnico asignado cuando se crea o reasigna
--            un mantenimiento programado (maintenance_schedule)
-- ----------------------------------------------------------------------------
create or replace function public.notify_on_schedule_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_agency_title text;
begin
  if new.responsable_id is null then
    return new;
  end if;

  -- Solo notificar si es un insert, o si cambió el responsable en un update
  if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and new.responsable_id is distinct from old.responsable_id) then
    select title into v_agency_title from public.agencies where id = new.agency_id;

    insert into public.notifications (user_id, mensaje, tipo, metadata)
    values (
      new.responsable_id,
      format('Se te asignó el mantenimiento de "%s" en %s para el %s',
             new.dept, coalesce(v_agency_title, 'tu agencia'), to_char(new.fecha, 'DD/MM/YYYY')),
      'asignacion',
      jsonb_build_object('schedule_id', new.id, 'agency_id', new.agency_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_schedule_assignment on public.maintenance_schedule;
create trigger trg_notify_schedule_assignment
  after insert or update on public.maintenance_schedule
  for each row execute function public.notify_on_schedule_assignment();

-- ----------------------------------------------------------------------------
-- TRIGGER 2 (opcional, requiere la extensión pg_cron disponible en tu proyecto
-- Supabase): recordatorio diario para mantenimientos que vencen en <= 2 días
-- y aún no están completados. Se ejecuta 1 vez al día vía pg_cron.
-- ----------------------------------------------------------------------------
create or replace function public.check_upcoming_maintenance()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, mensaje, tipo, metadata)
  select
    ms.responsable_id,
    format('Recordatorio: el mantenimiento de "%s" vence el %s', ms.dept, to_char(ms.fecha, 'DD/MM/YYYY')),
    'recordatorio',
    jsonb_build_object('schedule_id', ms.id, 'agency_id', ms.agency_id)
  from public.maintenance_schedule ms
  where ms.completado = false
    and ms.responsable_id is not null
    and ms.fecha between current_date and current_date + interval '2 days'
    -- evitar duplicados: que no exista ya un recordatorio de hoy para este schedule
    and not exists (
      select 1 from public.notifications n
      where n.metadata->>'schedule_id' = ms.id::text
        and n.tipo = 'recordatorio'
        and n.fecha::date = current_date
    );
end;
$$;

-- Para activar el recordatorio diario automático (requiere pg_cron habilitado
-- en Database > Extensions), ejecuta una sola vez:
--
-- select cron.schedule(
--   'check-upcoming-maintenance-daily',
--   '0 8 * * *',                          -- todos los días a las 8:00 am
--   $$ select public.check_upcoming_maintenance(); $$
-- );

-- ----------------------------------------------------------------------------
-- Habilitar Realtime en la tabla notifications
-- (En Supabase Studio: Database > Replication > agrega "notifications" a la
--  publicación supabase_realtime; o ejecuta lo siguiente)
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
