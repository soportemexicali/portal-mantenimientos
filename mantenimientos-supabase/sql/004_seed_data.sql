-- ============================================================================
-- 004_seed_data.sql
-- Migra los datos que hoy viven hardcodeados en BASELINE_DATA (el <script>
-- del dashboard) hacia las tablas cities / agencies / equipment_items.
-- Ajusta el nombre de la ciudad si tienes más de una.
-- ============================================================================

insert into public.cities (nombre) values ('Mexicali')
  on conflict (nombre) do nothing;

do $$
declare
  v_city_id uuid;
  v_agency_id uuid;
begin
  select id into v_city_id from public.cities where nombre = 'Mexicali';

  -- ---------------- KIA FUTURA MEXICALI (antes 'honda' en el JS) ----------------
  insert into public.agencies (slug, title, color, city_id)
  values ('kia_futura_mexicali', 'KIA FUTURA MEXICALI', '#10b981', v_city_id)
  on conflict (slug) do update set title = excluded.title
  returning id into v_agency_id;

  insert into public.equipment_items (agency_id, dept, comp, done) values
    (v_agency_id, 'SINIESTROS', 4, 4),
    (v_agency_id, 'TALLER', 9, 9),
    (v_agency_id, 'GARANTIAS', 4, 4),
    (v_agency_id, 'SERVICIO POSTVENTA', 9, 8),
    (v_agency_id, 'GTE POSTVENTA', 1, 0),
    (v_agency_id, 'CONTABILIDAD', 5, 5),
    (v_agency_id, 'REFACCIONES', 3, 3),
    (v_agency_id, 'VENTAS', 8, 1),
    (v_agency_id, 'SALA DE JUNTAS', 1, 0),
    (v_agency_id, 'CDC', 7, 0),
    (v_agency_id, 'SEGUROS', 1, 0),
    (v_agency_id, 'ISAAC GONZALEZ', 1, 0),
    (v_agency_id, 'FACTURACION', 1, 1),
    (v_agency_id, 'PLACAS', 1, 0),
    (v_agency_id, 'FINANCIAMIENTO', 1, 0),
    (v_agency_id, 'MERCADOTECNIA', 2, 0),
    (v_agency_id, 'COORD.CDC', 1, 0),
    (v_agency_id, 'RECEPCION', 2, 2),
    (v_agency_id, 'SEMINUEVOS', 3, 0),
    (v_agency_id, 'TMKT POSTVENTA', 5, 0)
  on conflict (agency_id, dept) do update set comp = excluded.comp, done = excluded.done;

  -- ---------------- HONDA MOTOS MEXICALI (antes 'toyota') ----------------
  insert into public.agencies (slug, title, color, city_id)
  values ('honda_motos_mexicali', 'HONDA MOTOS MEXICALI', '#f97316', v_city_id)
  on conflict (slug) do update set title = excluded.title
  returning id into v_agency_id;

  insert into public.equipment_items (agency_id, dept, comp, done) values
    (v_agency_id, 'GTE VENTA', 1, 1),
    (v_agency_id, 'CAJA', 1, 1),
    (v_agency_id, 'REFACCIONES', 1, 1),
    (v_agency_id, 'TALLER', 2, 2),
    (v_agency_id, 'VENTAS', 4, 4)
  on conflict (agency_id, dept) do update set comp = excluded.comp, done = excluded.done;

  -- ---------------- BODEGA MEXICALI (antes 'hyundai') ----------------
  insert into public.agencies (slug, title, color, city_id)
  values ('bodega_mexicali', 'BODEGA MEXICALI', '#0ea5e9', v_city_id)
  on conflict (slug) do update set title = excluded.title
  returning id into v_agency_id;

  insert into public.equipment_items (agency_id, dept, comp, done) values
    (v_agency_id, 'ALBERTO DEL VALLE', 1, 1),
    (v_agency_id, 'FABIAN MORENO', 1, 1),
    (v_agency_id, 'KARLA RAMOS', 1, 1),
    (v_agency_id, 'MARCOS', 1, 1),
    (v_agency_id, 'LAVADO', 1, 1)
  on conflict (agency_id, dept) do update set comp = excluded.comp, done = excluded.done;

  -- ---------------- HONDA AUTOS MEXICALI (antes 'chevrolet') ----------------
  insert into public.agencies (slug, title, color, city_id)
  values ('honda_autos_mexicali', 'HONDA AUTOS MEXICALI', '#a855f7', v_city_id)
  on conflict (slug) do update set title = excluded.title
  returning id into v_agency_id;

  insert into public.equipment_items (agency_id, dept, comp, done) values
    (v_agency_id, 'SINIESTROS', 2, 2),
    (v_agency_id, 'TALLER', 5, 5),
    (v_agency_id, 'GARANTIAS', 3, 3),
    (v_agency_id, 'ASESORES SERVICIO', 4, 4),
    (v_agency_id, 'GTE POSTVENTA', 1, 0),
    (v_agency_id, 'CONTABILIDAD', 8, 8),
    (v_agency_id, 'REFACCIONES', 3, 2),
    (v_agency_id, 'VENTAS', 6, 0),
    (v_agency_id, 'PERIQUERAS', 3, 3),
    (v_agency_id, 'CDC', 7, 7),
    (v_agency_id, 'SEGUROS', 1, 1),
    (v_agency_id, 'SALA DE JUNTAS', 1, 1),
    (v_agency_id, 'PLACAS', 1, 1),
    (v_agency_id, 'FINANCIAMIENTO', 2, 2),
    (v_agency_id, 'MERCADOTECNIA', 1, 0),
    (v_agency_id, 'COORD.CDC', 1, 0),
    (v_agency_id, 'RECEPCION', 1, 1),
    (v_agency_id, 'SEMINUEVOS', 5, 3),
    (v_agency_id, 'TMKT POSTVENTA', 5, 5)
  on conflict (agency_id, dept) do update set comp = excluded.comp, done = excluded.done;

end $$;

-- ----------------------------------------------------------------------------
-- Crea tu primer superadmin DESPUÉS de que esa persona se registre normalmente
-- desde el Login (o desde Authentication > Users en Supabase Studio).
-- Sustituye el correo real:
-- ----------------------------------------------------------------------------
-- update public.profiles set rol = 'superadmin', ciudad_id = null, agencias = '{}'
-- where email = 'tu_correo_admin@empresa.com';
