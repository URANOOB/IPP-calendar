-- Run through `supabase db query --linked --file supabase/tests/014_rbac_permissions.sql`.
-- Every fixture is rolled back, so this is safe for the linked environment.

begin;

do $$
declare
  v_admin_id uuid;
  v_manager_id uuid;
  v_admin_guardian_id uuid;
  v_manager_guardian_id uuid;
  v_admin_phone text := '+573' || lpad((floor(random() * 1000000000))::bigint::text, 9, '0');
  v_manager_phone text := '+573' || lpad((floor(random() * 1000000000))::bigint::text, 9, '0');
begin
  select id into v_admin_id from public.profiles where role = 'admin' and active order by created_at limit 1;
  select id into v_manager_id from public.profiles where role = 'manager' and active order by created_at limit 1;
  if v_admin_id is null or v_manager_id is null then
    raise exception 'The test requires one active admin and one active manager profile.';
  end if;

  -- Administrator: create, read, update and delete a representative business record.
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  execute 'set local role authenticated';
  if not public.is_admin() or not public.is_internal_user() then
    raise exception 'Admin role helpers returned an unexpected result.';
  end if;
  execute 'insert into public.guardians (full_name, phone) values ($1, $2) returning id'
    into v_admin_guardian_id using 'Prueba RBAC administrador', v_admin_phone;
  if not exists (select 1 from public.guardians where id = v_admin_guardian_id) then
    raise exception 'Admin could not read a record it created.';
  end if;
  update public.guardians set full_name = 'Prueba RBAC administrador editada' where id = v_admin_guardian_id;
  if not found then raise exception 'Admin could not update a business record.'; end if;
  delete from public.contact_tracking where guardian_id = v_admin_guardian_id;
  delete from public.guardians where id = v_admin_guardian_id;
  if not found then raise exception 'Admin could not delete a business record.'; end if;
  execute 'reset role';

  -- Manager: create, read and update, but never delete.
  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);
  execute 'set local role authenticated';
  if public.is_admin() or not public.is_manager() or not public.is_internal_user() then
    raise exception 'Manager role helpers returned an unexpected result.';
  end if;
  execute 'insert into public.guardians (full_name, phone) values ($1, $2) returning id'
    into v_manager_guardian_id using 'Prueba RBAC gestor', v_manager_phone;
  if not exists (select 1 from public.guardians where id = v_manager_guardian_id) then
    raise exception 'Manager could not read a record it created.';
  end if;
  update public.guardians set full_name = 'Prueba RBAC gestor editada' where id = v_manager_guardian_id;
  if not found then raise exception 'Manager could not update a business record.'; end if;
  delete from public.guardians where id = v_manager_guardian_id;
  if found then raise exception 'Manager was able to delete a business record.'; end if;
  update public.profiles set role = 'admin' where id = v_manager_id;
  if found then raise exception 'Manager was able to change an access role.'; end if;
  execute 'reset role';

  -- The administrator can clean up a manager-created record. It is still
  -- rolled back at the end to ensure the test leaves no trace.
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  execute 'set local role authenticated';
  delete from public.contact_tracking where guardian_id = v_manager_guardian_id;
  delete from public.guardians where id = v_manager_guardian_id;
  if not found then raise exception 'Admin could not delete a manager-created record.'; end if;
  execute 'reset role';

  -- Anonymous visitors no longer have a direct table privilege.
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'Anonymous users can select internal profiles.';
  exception when insufficient_privilege then
    null;
  end;
  execute 'reset role';
end;
$$;

rollback;
