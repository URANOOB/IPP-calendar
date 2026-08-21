-- Public guardian booking is deliberately mediated by security-definer RPCs.
-- Browser clients never receive table permissions for registrations.

create or replace function public.registration_consumes_capacity(p_status public.registration_status)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_status in ('pending', 'confirmed', 'attended', 'absent');
$$;

create or replace function public.enforce_registration_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_capacity integer;
  v_used integer;
begin
  if not public.registration_consumes_capacity(new.status) then
    return new;
  end if;

  select capacity into v_capacity from public.classes where id = new.class_id for update;
  if v_capacity is null then
    raise exception 'La clase seleccionada ya no está disponible.' using errcode = 'P0001';
  end if;

  select count(*) into v_used
  from public.registrations
  where class_id = new.class_id
    and public.registration_consumes_capacity(status)
    and (tg_op <> 'UPDATE' or id <> new.id);

  if v_used >= v_capacity then
    raise exception 'Esta clase acaba de llenarse.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger registrations_enforce_capacity
before insert or update of class_id, status on public.registrations
for each row execute function public.enforce_registration_capacity();

create or replace function public.get_guardian_registration_context(token_hash text)
returns table (
  guardian_name text,
  cycle_id uuid,
  cycle_name text,
  cycle_status public.weekly_cycle_status,
  registration_open boolean,
  students jsonb,
  classes jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_guardian_id uuid;
  v_cycle public.weekly_cycles%rowtype;
begin
  select id into v_guardian_id
  from public.guardians
  where access_token_hash = token_hash and active;
  if v_guardian_id is null then return; end if;

  select * into v_cycle
  from public.weekly_cycles
  where status <> 'archived'
  order by (status = 'open') desc, starts_at desc
  limit 1;

  return query
  select
    g.full_name,
    v_cycle.id,
    v_cycle.name,
    v_cycle.status,
    coalesce(v_cycle.status = 'open' and now() between v_cycle.registration_opens_at and v_cycle.registration_closes_at, false),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'full_name', s.full_name,
        'registration', case when r.id is null then null else jsonb_build_object(
          'class_id', c.id, 'title', c.title, 'teacher_name', t.display_name,
          'starts_at', c.starts_at, 'ends_at', c.ends_at, 'status', r.status
        ) end
      ) order by s.created_at)
      from public.students s
      left join public.registrations r on r.student_id = s.id and r.cycle_id = v_cycle.id
      left join public.classes c on c.id = r.class_id
      left join public.teachers t on t.id = c.teacher_id
      where s.guardian_id = g.id and s.active
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'teacher_name', t.display_name,
        'starts_at', c.starts_at, 'ends_at', c.ends_at, 'capacity', c.capacity,
        'registered', coalesce(used.count, 0),
        'available', greatest(c.capacity - coalesce(used.count, 0), 0)
      ) order by c.starts_at, c.ends_at, t.display_name)
      from public.classes c
      join public.teachers t on t.id = c.teacher_id
      left join lateral (
        select count(*)::integer as count from public.registrations r
        where r.class_id = c.id and public.registration_consumes_capacity(r.status)
      ) used on true
      where c.cycle_id = v_cycle.id and c.status = 'published' and v_cycle.status = 'open'
    ), '[]'::jsonb)
  from public.guardians g
  where g.id = v_guardian_id;
end;
$$;

create or replace function public.book_guardian_classes(token_hash text, selections jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian_id uuid;
  v_cycle public.weekly_cycles%rowtype;
  v_requested_count integer;
  v_valid_count integer;
  v_class record;
begin
  if coalesce(jsonb_typeof(selections) <> 'array', true) or jsonb_array_length(selections) = 0 or jsonb_array_length(selections) > 4 then
    raise exception 'Selecciona al menos una clase para continuar.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(selections) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item->>'student_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(item->>'class_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'No pudimos completar la inscripción. Revisa las clases seleccionadas.' using errcode = 'P0001';
  end if;

  select id into v_guardian_id from public.guardians
  where access_token_hash = token_hash and active for update;
  if v_guardian_id is null then
    raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001';
  end if;

  select * into v_cycle from public.weekly_cycles where status = 'open' for update;
  if v_cycle.id is null then
    raise exception 'Las inscripciones aún no están disponibles.' using errcode = 'P0001';
  end if;
  if now() < v_cycle.registration_opens_at then
    raise exception 'Las inscripciones aún no están disponibles.' using errcode = 'P0001';
  end if;
  if now() > v_cycle.registration_closes_at then
    raise exception 'Las inscripciones de esta semana ya finalizaron.' using errcode = 'P0001';
  end if;

  with requested as (
    select (item->>'student_id')::uuid as student_id, (item->>'class_id')::uuid as class_id
    from jsonb_array_elements(selections) item
  ) select count(*), count(distinct student_id) into v_requested_count, v_valid_count from requested;
  if v_requested_count <> v_valid_count then
    raise exception 'Cada niño solo puede tener una clase esta semana.' using errcode = 'P0001';
  end if;

  with requested as (
    select (item->>'student_id')::uuid as student_id from jsonb_array_elements(selections) item
  ) select count(*) into v_valid_count
  from requested q join public.students s on s.id = q.student_id
  where s.guardian_id = v_guardian_id and s.active;
  if v_valid_count <> v_requested_count then
    raise exception 'No pudimos completar la inscripción. Revisa las clases seleccionadas.' using errcode = 'P0001';
  end if;

  for v_class in
    select c.id from public.classes c
    where c.id in (select distinct (item->>'class_id')::uuid from jsonb_array_elements(selections) item)
    order by c.id for update
  loop
    perform v_class.id;
  end loop;

  with requested as (
    select (item->>'class_id')::uuid as class_id from jsonb_array_elements(selections) item
  ) select count(*) into v_valid_count
  from requested q join public.classes c on c.id = q.class_id
  where c.cycle_id = v_cycle.id and c.status = 'published';
  if v_valid_count <> v_requested_count then
    raise exception 'La clase seleccionada ya no está disponible.' using errcode = 'P0001';
  end if;

  if exists (
    with requested as (
      select (item->>'student_id')::uuid as student_id from jsonb_array_elements(selections) item
    ) select 1 from requested q join public.registrations r on r.student_id = q.student_id and r.cycle_id = v_cycle.id
  ) then
    raise exception 'Uno de tus niños ya tiene una clase programada esta semana.' using errcode = 'P0001';
  end if;

  if exists (
    with requested as (
      select (item->>'class_id')::uuid as class_id from jsonb_array_elements(selections) item
    ), needed as (
      select class_id, count(*)::integer as count from requested group by class_id
    )
    select 1 from needed n join public.classes c on c.id = n.class_id
    left join lateral (
      select count(*)::integer as count from public.registrations r
      where r.class_id = c.id and public.registration_consumes_capacity(r.status)
    ) used on true
    where used.count + n.count > c.capacity
  ) then
    raise exception 'Esta clase acaba de llenarse.' using errcode = 'P0001';
  end if;

  insert into public.registrations (student_id, class_id, cycle_id, status, confirmed_at)
  select (item->>'student_id')::uuid, (item->>'class_id')::uuid, v_cycle.id, 'confirmed', now()
  from jsonb_array_elements(selections) item;

  insert into public.contact_tracking (guardian_id, response_status, booked_at)
  values (v_guardian_id, 'booked', now())
  on conflict (guardian_id) do update
  set response_status = 'booked', booked_at = coalesce(contact_tracking.booked_at, excluded.booked_at);
end;
$$;

revoke all on function public.registration_consumes_capacity(public.registration_status) from public;
revoke all on function public.enforce_registration_capacity() from public;
revoke all on function public.get_guardian_registration_context(text) from public;
revoke all on function public.book_guardian_classes(text, jsonb) from public;
grant execute on function public.get_guardian_registration_context(text) to anon, authenticated;
grant execute on function public.book_guardian_classes(text, jsonb) to anon, authenticated;
