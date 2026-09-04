-- All notification fixtures and permission checks are rolled back.
begin;
do $$
declare
  manager_id uuid;
  admin_id uuid;
  fixture_id uuid := gen_random_uuid();
  single_id uuid;
  newer_id uuid;
  deleted_count integer;
  cutoff timestamptz := now() - interval '1 minute';
begin
  select id into manager_id from public.profiles where role = 'manager' and active limit 1;
  select id into admin_id from public.profiles where role = 'admin' and active limit 1;
  if manager_id is null or admin_id is null then raise exception 'Active admin and manager required'; end if;

  insert into public.platform_activity (entity_id, entity_type, action, subject, created_at)
  values (fixture_id, 'students', 'updated', 'Notification permission fixture', cutoff)
  returning id into single_id;
  insert into public.platform_activity (entity_id, entity_type, action, subject, created_at)
  select fixture_id, 'students', 'updated', 'Old notification fixture', cutoff - interval '1 hour'
  from generate_series(1, 25);
  insert into public.platform_activity (entity_id, entity_type, action, subject, created_at)
  values (fixture_id, 'students', 'updated', 'New notification fixture', now())
  returning id into newer_id;

  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  execute 'set local role authenticated';
  delete from public.platform_activity where id = single_id;
  if not found then raise exception 'Manager could not delete a notification'; end if;
  delete from public.platform_activity where entity_id = fixture_id and created_at <= cutoff;
  get diagnostics deleted_count = row_count;
  if deleted_count <> 25 then raise exception 'Bulk cleanup must also remove older, undisplayed notifications'; end if;
  if not exists (select 1 from public.platform_activity where id = newer_id) then
    raise exception 'Bulk cleanup removed a newer notification';
  end if;
  execute 'reset role';

  update public.profiles set active = false where id = manager_id;
  execute 'set local role authenticated';
  delete from public.platform_activity where id = newer_id;
  if found then raise exception 'Inactive manager could delete activity'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  begin
    delete from public.platform_activity where id = newer_id;
    raise exception 'Anonymous deletion must not be allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  execute 'set local role authenticated';
  delete from public.platform_activity where id = newer_id;
  if not found then raise exception 'Admin lost notification deletion permission'; end if;
  execute 'reset role';
end $$;
rollback;
