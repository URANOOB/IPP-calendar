-- The public registration address is permanent. Cycles only determine when
-- registrations are allowed and which classes the resulting private link sees.
drop function if exists public.get_cycle_registration_welcome(text);
drop function if exists public.activate_guardian_cycle_access(text, text, text, jsonb, text, text);

drop trigger if exists weekly_cycles_assign_registration_token on public.weekly_cycles;
drop function if exists public.ensure_weekly_cycle_registration_token();
drop index if exists public.weekly_cycles_registration_token_key;
alter table public.weekly_cycles drop column if exists registration_token;

-- A permanent address can identify only one registration period at a time.
alter table public.weekly_cycles
  add constraint weekly_cycles_no_registration_window_overlap
  exclude using gist (
    tstzrange(registration_opens_at, registration_closes_at, '[)') with &&
  ) where (status = 'open');

create function public.get_general_registration_welcome()
returns table (cycle_name text, registration_open boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select wc.name
      from public.weekly_cycles wc
      where wc.status = 'open'
        and now() between wc.registration_opens_at and wc.registration_closes_at
      order by wc.registration_opens_at, wc.starts_at
      limit 1
    ), 'Inscripción de clases'),
    exists (
      select 1
      from public.weekly_cycles wc
      where wc.status = 'open'
        and now() between wc.registration_opens_at and wc.registration_closes_at
    );
$$;

create function public.activate_guardian_cycle_access(
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

  select g.id, g.active into v_guardian_id, v_guardian_active
  from public.guardians g where g.phone = p_phone for update;
  if v_guardian_id is null then
    insert into public.guardians (full_name, phone)
    values (btrim(p_full_name), p_phone)
    returning id into v_guardian_id;
    perform public.add_new_guardian_students(v_guardian_id, p_student_names);
  elsif not v_guardian_active then
    raise exception 'Este acudiente está inactivo. Pide ayuda a la organización.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.students s where s.guardian_id = v_guardian_id and s.active) then
    raise exception 'Este registro no tiene estudiantes activos. Pide ayuda a la organización.' using errcode = 'P0001';
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

revoke all on function public.get_general_registration_welcome() from public;
revoke all on function public.activate_guardian_cycle_access(text, text, jsonb, text, text) from public;
grant execute on function public.get_general_registration_welcome() to anon, authenticated;
grant execute on function public.activate_guardian_cycle_access(text, text, jsonb, text, text) to anon, authenticated;
