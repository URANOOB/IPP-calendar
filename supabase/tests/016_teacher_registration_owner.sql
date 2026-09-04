-- Reverted fixtures: a manager may register multiple independent teachers.
begin;
do $$
declare manager_id uuid; first_id uuid; second_id uuid;
begin
  select id into manager_id from public.profiles where role='manager' and active limit 1;
  if manager_id is null then raise exception 'Requires an active manager'; end if;
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  execute 'set local role authenticated';
  insert into public.teachers(display_name, notification_email)
    values('Audit teacher one','one@example.invalid') returning id into first_id;
  insert into public.teachers(display_name, notification_email)
    values('Audit teacher two','two@example.invalid') returning id into second_id;
  if (select count(*) from public.teachers where id in (first_id,second_id) and profile_id=manager_id) <> 2 then
    raise exception 'Teachers must default to the logged-in registrar';
  end if;
  if (select count(*) from public.admin_teacher_directory() where teacher_id in (first_id,second_id)) <> 2 then
    raise exception 'Both teachers must appear independently in the directory';
  end if;
  execute 'reset role';
end;
$$;
rollback;
