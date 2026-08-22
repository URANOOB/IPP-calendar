-- A guardian created through the public form follows a different operational
-- path: they are already interested and do not need outreach by WhatsApp.
alter table public.contact_tracking
  add column if not exists registered_from_public_at timestamptz;

alter type public.contact_event_type add value if not exists 'registered_from_form';

create or replace function public.activate_guardian_cycle_access(
  p_phone text,
  p_full_name text,
  p_student_names jsonb,
  p_access_token text,
  p_token_hash text
)
returns table (access_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.weekly_cycles%rowtype;
  v_guardian_id uuid;
  v_guardian_active boolean;
  v_guardian_name text;
  v_access_token text;
  v_created_from_form boolean := false;
begin
  if p_access_token !~ '^[A-Za-z0-9_-]{43}$'
     or p_token_hash <> encode(extensions.digest(p_access_token, 'sha256'), 'hex') then
    raise exception 'No fue posible crear el enlace privado.' using errcode = 'P0001';
  end if;
  if p_phone !~ E'^\\+573[0-9]{9}$' then
    raise exception 'Ingresa un celular colombiano válido.' using errcode = 'P0001';
  end if;
  if char_length(btrim(p_full_name)) < 2 or char_length(btrim(p_full_name)) > 120 then
    raise exception 'Ingresa tu nombre completo.' using errcode = 'P0001';
  end if;

  select * into v_cycle
  from public.weekly_cycles wc
  where wc.status = 'open'
    and now() between wc.registration_opens_at and wc.registration_closes_at
  order by wc.registration_opens_at, wc.starts_at
  limit 1
  for update;
  if v_cycle.id is null then
    raise exception 'Este enlace general no está disponible para inscripciones en este momento.' using errcode = 'P0001';
  end if;

  select g.id, g.active, g.full_name into v_guardian_id, v_guardian_active, v_guardian_name
  from public.guardians g where g.phone = p_phone for update;
  if v_guardian_id is null then
    insert into public.guardians (full_name, phone)
    values (btrim(p_full_name), p_phone)
    returning id into v_guardian_id;
    perform public.add_new_guardian_students(v_guardian_id, p_student_names);
    v_created_from_form := true;
  elsif not v_guardian_active then
    raise exception 'Este acudiente está inactivo. Pide ayuda a la organización.' using errcode = 'P0001';
  elsif v_guardian_name is null then
    update public.guardians set full_name = btrim(p_full_name) where id = v_guardian_id;
    perform public.add_new_guardian_students(v_guardian_id, p_student_names);
  end if;

  if not exists (select 1 from public.students s where s.guardian_id = v_guardian_id and s.active) then
    raise exception 'Este registro no tiene estudiantes activos. Pide ayuda a la organización.' using errcode = 'P0001';
  end if;

  if v_created_from_form then
    update public.contact_tracking
    set response_status = 'interested', registered_from_public_at = now()
    where guardian_id = v_guardian_id;
    insert into public.contact_events (guardian_id, event_type, metadata)
    values (v_guardian_id, 'registered_from_form', jsonb_build_object('source', 'general_registration'));
  end if;

  select i.access_token into v_access_token from public.guardian_cycle_invitations i
  where i.guardian_id = v_guardian_id and i.cycle_id = v_cycle.id and i.active and i.access_token is not null
  for update;
  if found then
    return query select v_access_token;
    return;
  end if;

  insert into public.guardian_cycle_invitations (guardian_id, cycle_id, token_hash, access_token, activated_at)
  values (v_guardian_id, v_cycle.id, p_token_hash, p_access_token, now());
  return query select p_access_token;
end;
$$;

revoke all on function public.activate_guardian_cycle_access(text, text, jsonb, text, text) from public;
grant execute on function public.activate_guardian_cycle_access(text, text, jsonb, text, text) to anon, authenticated;

-- Booking a class does not replace the operational result of an autonomous
-- registration. Preloaded phone-only contacts still become "booked" as before.
create or replace function public.book_guardian_classes(token_hash text, selections jsonb, p_guardian_name text default null)
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
begin
  perform p_guardian_name;
  if jsonb_typeof(selections) <> 'array' or jsonb_array_length(selections) = 0 or jsonb_array_length(selections) > 10 then
    raise exception 'Selecciona al menos una clase para continuar.' using errcode = 'P0001';
  end if;

  select i.guardian_id, i.cycle_id into g_id, v_cycle_id
  from public.guardian_cycle_invitations i
  join public.guardians g on g.id = i.guardian_id and g.active
  where i.token_hash = book_guardian_classes.token_hash
    and i.active
    and (i.expires_at is null or i.expires_at > now())
  for update of i;
  if g_id is null then raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001'; end if;

  select * into v_cycle from public.weekly_cycles where id = v_cycle_id for update;
  if v_cycle.status <> 'open' or now() not between v_cycle.registration_opens_at and v_cycle.registration_closes_at then
    raise exception 'Las inscripciones de esta semana ya finalizaron.' using errcode = 'P0001';
  end if;

  with q as (
    select (x->>'student_id')::uuid student_id, (x->>'class_id')::uuid class_id
    from jsonb_array_elements(selections) x
  )
  select count(*), count(distinct student_id) into requested, valid from q;
  if requested <> valid then raise exception 'Cada niño solo puede tener una clase esta semana.' using errcode = 'P0001'; end if;

  if (
    select count(*)
    from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections) x) q
    join public.students s on s.id = q.student_id and s.guardian_id = g_id and s.active
  ) <> requested then raise exception 'No pudimos completar la inscripción. Revisa las clases seleccionadas.' using errcode = 'P0001'; end if;

  for row_class in
    select c.id from public.classes c
    where c.id in (select (x->>'class_id')::uuid from jsonb_array_elements(selections) x)
    order by c.id
    for update
  loop
    perform row_class.id;
  end loop;

  if (
    select count(*)
    from (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x) q
    join public.classes c on c.id = q.class_id and c.cycle_id = v_cycle.id and c.status = 'published'
  ) <> requested then raise exception 'La clase seleccionada ya no está disponible.' using errcode = 'P0001'; end if;

  if exists (
    select 1
    from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections) x) q
    join public.registrations r on r.student_id = q.student_id and r.cycle_id = v_cycle.id
  ) then raise exception 'Uno de tus niños ya tiene una clase programada esta semana.' using errcode = 'P0001'; end if;

  if exists (
    with q as (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x), n as (select class_id, count(*) count from q group by class_id)
    select 1 from n join public.classes c on c.id = n.class_id
    where n.count + (select count(*) from public.registrations r where r.class_id = c.id and public.registration_consumes_capacity(r.status)) > c.capacity
  ) then raise exception 'Esta clase acaba de llenarse.' using errcode = 'P0001'; end if;

  insert into public.registrations(student_id, class_id, cycle_id, status, confirmed_at)
  select (x->>'student_id')::uuid, (x->>'class_id')::uuid, v_cycle.id, 'confirmed', now()
  from jsonb_array_elements(selections) x;

  update public.contact_tracking
  set response_status = case when registered_from_public_at is null then 'booked' else response_status end,
      booked_at = coalesce(booked_at, now())
  where guardian_id = g_id;
end;
$$;

revoke all on function public.book_guardian_classes(text, jsonb, text) from public;
grant execute on function public.book_guardian_classes(text, jsonb, text) to anon, authenticated;
