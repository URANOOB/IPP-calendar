begin;

select plan(1);

do $$
declare
  v_profile uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'availability-' || v_profile || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into public.profiles (id, role, full_name) values (v_profile, 'teacher', 'Profesor disponible');
  insert into public.teachers (id, profile_id, display_name, available_days, available_from, available_until)
  values (v_teacher, v_profile, 'Profesor disponible', array[1, 3, 5]::smallint[], '09:00', '12:00');
  if (select available_days from public.teachers where id = v_teacher) <> array[1, 3, 5]::smallint[] then
    raise exception 'Selected available days were not stored';
  end if;
  if (select available_from from public.teachers where id = v_teacher) <> '09:00'::time
     or (select available_until from public.teachers where id = v_teacher) <> '12:00'::time then
    raise exception 'Availability times were not stored';
  end if;
  begin
    update public.teachers set available_until = '08:00' where id = v_teacher;
    raise exception 'Invalid availability range was accepted';
  exception when check_violation then null;
  end;
end;
$$;

select pass('Teacher weekly availability requires valid days and an ordered time range.');
select * from finish();

rollback;
