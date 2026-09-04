begin;

alter table public.guardian_cycle_invitations add column registration_completed_at timestamptz;

-- Preserve existing completed registrations; pending links remain dormant.
update public.guardian_cycle_invitations i
set registration_completed_at = coalesce(i.activated_at, i.created_at)
where i.access_token is not null
  and exists (select 1 from public.guardians g where g.id = i.guardian_id and char_length(btrim(g.full_name)) >= 2)
  and exists (select 1 from public.students s where s.guardian_id = i.guardian_id and s.active);

do $$
declare definition text; old_branch text; signature regprocedure;
begin
  definition := replace(pg_get_functiondef('public.activate_guardian_cycle_access(text,text,jsonb,text,text)'::regprocedure), E'\r\n', E'\n');
  old_branch := E'  if found then\n    return query select v_access_token;';
  if position(old_branch in definition) = 0 then raise exception 'Expected existing invitation return not found'; end if;
  definition := replace(definition, old_branch,
    E'  if found then\n    update public.guardian_cycle_invitations i set registration_completed_at = coalesce(i.registration_completed_at, now())\n      where i.guardian_id = v_guardian_id and i.cycle_id = v_cycle.id and i.access_token = v_access_token;\n    return query select v_access_token;');
  if position('(guardian_id, cycle_id, token_hash, access_token, activated_at)' in definition) = 0 then raise exception 'Expected invitation insert not found'; end if;
  definition := replace(definition, '(guardian_id, cycle_id, token_hash, access_token, activated_at)', '(guardian_id, cycle_id, token_hash, access_token, activated_at, registration_completed_at)');
  definition := replace(definition, '(v_guardian_id, v_cycle.id, p_token_hash, p_access_token, now())', '(v_guardian_id, v_cycle.id, p_token_hash, p_access_token, now(), now())');
  execute definition;

  foreach signature in array array[
    'public.get_guardian_registration_context(text)'::regprocedure,
    'public.get_guardian_waiting_room(text)'::regprocedure,
    'public.get_guardian_meeting_access(text,uuid,uuid)'::regprocedure
  ] loop
    definition := pg_get_functiondef(signature);
    if position('i.token_hash = $1' in definition) = 0 then raise exception 'Expected token check not found in %', signature; end if;
    execute replace(definition, 'i.token_hash = $1', 'i.token_hash = $1 and i.registration_completed_at is not null');
  end loop;
  definition := pg_get_functiondef('public.book_guardian_classes(text,jsonb,text)'::regprocedure);
  if position('i.token_hash = book_guardian_classes.token_hash' in definition) = 0 then raise exception 'Expected booking token check not found'; end if;
  execute replace(definition, 'i.token_hash = book_guardian_classes.token_hash', 'i.token_hash = book_guardian_classes.token_hash and i.registration_completed_at is not null');

  definition := pg_get_functiondef('public.list_contact_guardians(text,boolean,integer,integer)'::regprocedure);
  if position('where i.guardian_id = p.id' in definition) = 0 then raise exception 'Expected contact link query not found'; end if;
  execute replace(definition, 'where i.guardian_id = p.id', 'where i.guardian_id = p.id and i.registration_completed_at is not null');
end;
$$;

-- Only the general registration form activates a private link from now on.
revoke all on function public.ensure_staff_guardian_access(uuid,uuid) from public, anon, authenticated;
revoke all on function public.complete_private_guardian_profile(text,text,jsonb) from public, anon, authenticated;

commit;
