-- A guardian is identified operationally by their phone number. Their name is
-- collected later, during the optional public booking flow.
alter table public.guardians
  alter column full_name drop not null;

drop function if exists public.list_contact_guardians(text, boolean, integer, integer);
create function public.list_contact_guardians(
  p_search text default null,
  p_active boolean default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  phone text,
  active boolean,
  student_count bigint,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with filtered as (
    select
      g.id,
      g.full_name,
      g.phone,
      g.active,
      count(s.id)::bigint as student_count,
      count(*) over ()::bigint as total_count
    from public.guardians g
    left join public.students s on s.guardian_id = g.id
    where (p_active is null or g.active = p_active)
      and (
        nullif(regexp_replace(p_search, '\D', '', 'g'), '') is null
        or regexp_replace(g.phone, '\D', '', 'g') like '%' || regexp_replace(p_search, '\D', '', 'g') || '%'
      )
    group by g.id, g.full_name, g.phone, g.active
  )
  select id, full_name, phone, active, student_count, total_count
  from filtered
  order by phone, id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_contact_guardians(text, boolean, integer, integer) from public;
grant execute on function public.list_contact_guardians(text, boolean, integer, integer) to authenticated;

drop function if exists public.book_guardian_classes(text, jsonb);
create function public.book_guardian_classes(token_hash text, selections jsonb, p_guardian_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g_id uuid;
  v_cycle_id uuid;
  v_cycle public.weekly_cycles%rowtype;
  requested integer;
  valid integer;
  row_class record;
  v_guardian_name text := nullif(btrim(p_guardian_name), '');
begin
  if jsonb_typeof(selections) <> 'array' or jsonb_array_length(selections) = 0 or jsonb_array_length(selections) > 10 then
    raise exception 'Selecciona al menos una clase para continuar.' using errcode = 'P0001';
  end if;
  if v_guardian_name is not null and (char_length(v_guardian_name) < 2 or char_length(v_guardian_name) > 120) then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres.' using errcode = 'P0001';
  end if;
  select i.guardian_id, i.cycle_id into g_id, v_cycle_id
  from public.guardian_cycle_invitations i
  join public.guardians g on g.id = i.guardian_id and g.active
  where i.token_hash = book_guardian_classes.token_hash and i.active and (i.expires_at is null or i.expires_at > now())
  for update of i;
  if g_id is null then raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001'; end if;
  select * into v_cycle from public.weekly_cycles where id = v_cycle_id for update;
  if v_cycle.status <> 'open' or now() not between v_cycle.registration_opens_at and v_cycle.registration_closes_at then raise exception 'Las inscripciones de esta semana ya finalizaron.' using errcode = 'P0001'; end if;
  with q as (select (x->>'student_id')::uuid student_id, (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x)
  select count(*), count(distinct student_id) into requested, valid from q;
  if requested <> valid then raise exception 'Cada niño solo puede tener una clase esta semana.' using errcode = 'P0001'; end if;
  if (select count(*) from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections) x) q join public.students s on s.id = q.student_id and s.guardian_id = g_id and s.active) <> requested then raise exception 'No pudimos completar la inscripción. Revisa las clases seleccionadas.' using errcode = 'P0001'; end if;
  for row_class in select c.id from public.classes c where c.id in (select (x->>'class_id')::uuid from jsonb_array_elements(selections) x) order by c.id for update loop perform row_class.id; end loop;
  if (select count(*) from (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x) q join public.classes c on c.id = q.class_id and c.cycle_id = v_cycle.id and c.status = 'published') <> requested then raise exception 'La clase seleccionada ya no está disponible.' using errcode = 'P0001'; end if;
  if exists (select 1 from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections) x) q join public.registrations r on r.student_id = q.student_id and r.cycle_id = v_cycle.id) then raise exception 'Uno de tus niños ya tiene una clase programada esta semana.' using errcode = 'P0001'; end if;
  if exists (with q as (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x), n as (select class_id, count(*) count from q group by class_id) select 1 from n join public.classes c on c.id = n.class_id where n.count + (select count(*) from public.registrations r where r.class_id = c.id and public.registration_consumes_capacity(r.status)) > c.capacity) then raise exception 'Esta clase acaba de llenarse.' using errcode = 'P0001'; end if;
  if v_guardian_name is not null then update public.guardians set full_name = v_guardian_name where id = g_id; end if;
  insert into public.registrations(student_id, class_id, cycle_id, status, confirmed_at)
  select (x->>'student_id')::uuid, (x->>'class_id')::uuid, v_cycle.id, 'confirmed', now() from jsonb_array_elements(selections) x;
  update public.contact_tracking set response_status = 'booked', booked_at = coalesce(booked_at, now()) where guardian_id = g_id;
end;
$$;

revoke all on function public.book_guardian_classes(text, jsonb, text) from public;
grant execute on function public.book_guardian_classes(text, jsonb, text) to anon, authenticated;
