begin;

-- Staff may prepare a personal link before registrations open. Booking still
-- uses the existing public RPCs and their cycle/date/capacity checks.
create or replace function public.ensure_staff_guardian_access(
  p_guardian_id uuid,
  p_cycle_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
  v_guardian public.guardians%rowtype;
  v_token text;
begin
  if not public.is_internal_user() then
    raise exception 'No tienes permisos para generar enlaces privados.' using errcode = '42501';
  end if;

  -- Match the current registration window, otherwise the next one. Never
  -- choose an old cycle which was left marked as open.
  select wc.id into v_cycle_id from public.weekly_cycles wc
  where wc.status = 'open' and wc.registration_closes_at > now()
    and (p_cycle_id is null or wc.id = p_cycle_id)
  order by wc.registration_opens_at, wc.starts_at, wc.id
  limit 1 for update;
  if v_cycle_id is null then
    if p_cycle_id is not null then
      raise exception 'Este ciclo ya no está disponible para generar enlaces.' using errcode = 'P0001';
    end if;
    return null;
  end if;

  -- Lock in the same order as public activation: cycle, then guardian.
  select * into v_guardian from public.guardians where id = p_guardian_id for update;
  if v_guardian.id is null or not v_guardian.active then
    raise exception 'El acudiente no está activo.' using errcode = 'P0001';
  end if;
  if coalesce(char_length(btrim(v_guardian.full_name)), 0) < 2 then
    raise exception 'Guarda el nombre del acudiente antes de generar su enlace.' using errcode = 'P0001';
  end if;

  select i.access_token into v_token from public.guardian_cycle_invitations i
  where i.guardian_id = p_guardian_id and i.cycle_id = v_cycle_id
    and i.active and i.access_token is not null
    and (i.expires_at is null or i.expires_at > now());
  if v_token is not null then return v_token; end if;

  update public.guardian_cycle_invitations set active = false
  where guardian_id = p_guardian_id and cycle_id = v_cycle_id
    and active and expires_at <= now();
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.guardian_cycle_invitations
    (guardian_id, cycle_id, token_hash, access_token, activated_at, created_by)
  values (p_guardian_id, v_cycle_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_token, now(), auth.uid());
  -- Generating/copying a link does not mean an invitation has been sent.
  return v_token;
end;
$$;

revoke all on function public.ensure_staff_guardian_access(uuid, uuid) from public, anon;
grant execute on function public.ensure_staff_guardian_access(uuid, uuid) to authenticated;

commit;
