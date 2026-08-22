-- A cycle has one simple welcome link. A guardian's private link is activated
-- only after they identify themselves from that welcome link.
alter table public.weekly_cycles
  add column registration_token text;

update public.weekly_cycles
set registration_token = encode(extensions.gen_random_bytes(32), 'hex')
where registration_token is null;

alter table public.weekly_cycles
  alter column registration_token set not null,
  alter column registration_token set default encode(extensions.gen_random_bytes(32), 'hex');

create unique index weekly_cycles_registration_token_key
  on public.weekly_cycles (registration_token);

create or replace function public.ensure_weekly_cycle_registration_token()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.registration_token is null or btrim(new.registration_token) = '' then
    new.registration_token := encode(extensions.gen_random_bytes(32), 'hex');
  end if;
  return new;
end;
$$;

create trigger weekly_cycles_assign_registration_token
before insert on public.weekly_cycles
for each row execute function public.ensure_weekly_cycle_registration_token();

alter table public.guardian_cycle_invitations
  add column access_token text,
  add column activated_at timestamptz;

update public.guardian_cycle_invitations
set active = false
where access_token is null;

create unique index guardian_cycle_invitations_access_token_key
  on public.guardian_cycle_invitations (access_token)
  where access_token is not null;

create unique index guardian_cycle_invitations_one_active_access_per_cycle_key
  on public.guardian_cycle_invitations (guardian_id, cycle_id)
  where active and access_token is not null;

create or replace function public.get_cycle_registration_welcome(p_registration_token text)
returns table (cycle_name text, registration_open boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    wc.name,
    wc.status = 'open' and now() between wc.registration_opens_at and wc.registration_closes_at
  from public.weekly_cycles wc
  where wc.registration_token = p_registration_token;
$$;

create or replace function public.activate_guardian_cycle_access(
  p_registration_token text,
  p_phone text,
  p_full_name text,
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

  select * into v_cycle
  from public.weekly_cycles wc
  where wc.registration_token = p_registration_token
  for update;

  if v_cycle.id is null or v_cycle.status <> 'open'
     or now() not between v_cycle.registration_opens_at and v_cycle.registration_closes_at then
    raise exception 'Este enlace general no está disponible para inscripciones en este momento.' using errcode = 'P0001';
  end if;

  select g.id into v_guardian_id
  from public.guardians g
  where g.phone = p_phone and g.active
  for update;

  if v_guardian_id is null then
    raise exception 'No encontramos un acudiente activo con ese celular. Pide ayuda a la organización.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.students s where s.guardian_id = v_guardian_id and s.active
  ) then
    raise exception 'Este acudiente todavía no tiene estudiantes activos registrados.' using errcode = 'P0001';
  end if;

  update public.guardians
  set full_name = btrim(p_full_name)
  where id = v_guardian_id;

  select i.access_token into v_access_token
  from public.guardian_cycle_invitations i
  where i.guardian_id = v_guardian_id
    and i.cycle_id = v_cycle.id
    and i.active
    and i.access_token is not null
  for update;

  if found then
    return query select v_access_token;
    return;
  end if;

  insert into public.guardian_cycle_invitations (
    guardian_id,
    cycle_id,
    token_hash,
    access_token,
    activated_at
  ) values (
    v_guardian_id,
    v_cycle.id,
    p_token_hash,
    p_access_token,
    now()
  );

  return query select p_access_token;
end;
$$;


revoke all on function public.get_cycle_registration_welcome(text) from public;
revoke all on function public.activate_guardian_cycle_access(text, text, text, text, text) from public;
grant execute on function public.get_cycle_registration_welcome(text) to anon, authenticated;
grant execute on function public.activate_guardian_cycle_access(text, text, text, text, text) to anon, authenticated;


revoke all on function public.create_guardian_cycle_invitation(uuid, uuid, text) from public;


revoke insert, update on public.guardian_cycle_invitations from authenticated;


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
  access_token text,
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
        nullif(btrim(p_search), '') is null
        or g.full_name ilike '%' || btrim(p_search) || '%'
        or (
          nullif(regexp_replace(p_search, E'\\D', '', 'g'), '') is not null
          and regexp_replace(g.phone, E'\\D', '', 'g') like '%' || regexp_replace(p_search, E'\\D', '', 'g') || '%'
        )
      )
    group by g.id, g.full_name, g.phone, g.active
  ), paged as (
    select *
    from filtered
    order by full_name, id
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    p.id,
    p.full_name,
    p.phone,
    p.active,
    p.student_count,
    i.access_token,
    p.total_count
  from paged p
  left join lateral (
    select i.access_token
    from public.guardian_cycle_invitations i
    join public.weekly_cycles wc on wc.id = i.cycle_id and wc.status = 'open'
    where i.guardian_id = p.id and i.active and i.access_token is not null
    order by i.activated_at desc nulls last
    limit 1
  ) i on true
  order by p.full_name, p.id;
$$;

revoke all on function public.list_contact_guardians(text, boolean, integer, integer) from public;
grant execute on function public.list_contact_guardians(text, boolean, integer, integer) to authenticated;
