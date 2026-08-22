-- Guardians are now created together with at least one student, either by
-- staff or from the public cycle welcome page.
create or replace function public.add_new_guardian_students(p_guardian_id uuid, p_student_names jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_name text;
begin
  if jsonb_typeof(p_student_names) <> 'array'
     or jsonb_array_length(p_student_names) < 1
     or jsonb_array_length(p_student_names) > 10 then
    raise exception 'Agrega entre uno y diez estudiantes.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_student_names) item
    where char_length(btrim(item)) < 2 or char_length(btrim(item)) > 120
  ) then
    raise exception 'Revisa los nombres de los estudiantes.' using errcode = 'P0001';
  end if;
  if (select count(*) from jsonb_array_elements_text(p_student_names)) <> (
    select count(distinct lower(btrim(item))) from jsonb_array_elements_text(p_student_names) item
  ) then
    raise exception 'Cada estudiante debe aparecer una sola vez.' using errcode = 'P0001';
  end if;

  for v_student_name in
    select btrim(item) from jsonb_array_elements_text(p_student_names) item
  loop
    if not exists (
      select 1 from public.students s
      where s.guardian_id = p_guardian_id and lower(s.full_name) = lower(v_student_name)
    ) then
      insert into public.students (guardian_id, full_name) values (p_guardian_id, v_student_name);
    end if;
  end loop;
end;
$$;

revoke all on function public.add_new_guardian_students(uuid, jsonb) from public;

create or replace function public.create_guardian_with_students(
  p_full_name text,
  p_phone text,
  p_student_names jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian_id uuid;
begin
  if not (public.is_admin() or public.is_contact_manager()) then
    raise exception 'No tienes permisos para crear acudientes.' using errcode = 'P0001';
  end if;
  if p_phone !~ E'^\\+573[0-9]{9}$' then
    raise exception 'Ingresa un celular colombiano válido.' using errcode = 'P0001';
  end if;
  if char_length(btrim(p_full_name)) < 2 or char_length(btrim(p_full_name)) > 120 then
    raise exception 'Ingresa el nombre completo del acudiente.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.guardians where phone = p_phone) then
    raise exception 'Ya existe un acudiente registrado con este número.' using errcode = 'P0001';
  end if;

  insert into public.guardians (full_name, phone)
  values (btrim(p_full_name), p_phone)
  returning id into v_guardian_id;
  perform public.add_new_guardian_students(v_guardian_id, p_student_names);
  return v_guardian_id;
end;
$$;

revoke all on function public.create_guardian_with_students(text, text, jsonb) from public;
grant execute on function public.create_guardian_with_students(text, text, jsonb) to authenticated;

drop function public.activate_guardian_cycle_access(text, text, text, text, text);

create function public.activate_guardian_cycle_access(
  p_registration_token text,
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
  v_access_token text;
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
  select * into v_cycle from public.weekly_cycles wc where wc.registration_token = p_registration_token for update;
  if v_cycle.id is null or v_cycle.status <> 'open' or now() not between v_cycle.registration_opens_at and v_cycle.registration_closes_at then
    raise exception 'Este enlace general no está disponible para inscripciones en este momento.' using errcode = 'P0001';
  end if;

  insert into public.guardians (full_name, phone)
  values (btrim(p_full_name), p_phone)
  on conflict (phone) do update set full_name = excluded.full_name
  where public.guardians.active
  returning id into v_guardian_id;
  if v_guardian_id is null then
    raise exception 'No encontramos un acudiente activo con ese celular. Pide ayuda a la organización.' using errcode = 'P0001';
  end if;

  perform public.add_new_guardian_students(v_guardian_id, p_student_names);
  if not exists (select 1 from public.students s where s.guardian_id = v_guardian_id and s.active) then
    raise exception 'Agrega al menos un estudiante activo para continuar.' using errcode = 'P0001';
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

revoke all on function public.activate_guardian_cycle_access(text, text, text, jsonb, text, text) from public;
grant execute on function public.activate_guardian_cycle_access(text, text, text, jsonb, text, text) to anon, authenticated;
