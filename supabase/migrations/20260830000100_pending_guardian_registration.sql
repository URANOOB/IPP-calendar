-- Staff can preload a phone number; the guardian then completes their data
-- through the general registration form. A direct public registration is
-- explicitly reflected in operational tracking.
alter type public.contact_response_status add value if not exists 'registered';

create or replace function public.create_pending_guardian(p_phone text)
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
  if exists (select 1 from public.guardians where phone = p_phone) then
    raise exception 'Ya existe un acudiente registrado con este número.' using errcode = 'P0001';
  end if;

  insert into public.guardians (full_name, phone)
  values (null, p_phone)
  returning id into v_guardian_id;
  return v_guardian_id;
end;
$$;

revoke all on function public.create_pending_guardian(text) from public;
grant execute on function public.create_pending_guardian(text) to authenticated;

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
    update public.contact_tracking set response_status = 'registered' where guardian_id = v_guardian_id;
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
