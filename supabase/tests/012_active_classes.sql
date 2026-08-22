begin;

select plan(3);

do $$
declare
  v_profile uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
begin
  update public.weekly_cycles set status = 'closed' where status = 'open';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'active-class-' || v_profile || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into public.profiles (id, role, full_name) values (v_profile, 'teacher', 'Profesora de prueba');
  insert into public.teachers (id, profile_id, display_name) values (v_teacher, v_profile, 'Profesora de prueba');
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status)
  values (v_cycle, 'Ciclo para clases', now() - interval '1 day', now() + interval '1 day', now() - interval '2 days', now() + interval '12 hours', 'open');

  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, meeting_url)
  values (v_class, v_cycle, v_teacher, 'Clase activa', now() + interval '1 hour', now() + interval '2 hours', 1, 'https://meet.example.test/active');
  if (select status from public.classes where id = v_class) <> 'published' then
    raise exception 'New classes must be active immediately';
  end if;

  begin
    insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity)
    values (v_cycle, v_teacher, 'Sin sala', now() + interval '3 hours', now() + interval '4 hours', 1);
    raise exception 'A meeting link must be required';
  exception when check_violation then null;
  end;

  begin
    insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity, meeting_url)
    values (v_cycle, v_teacher, 'Fuera de rango', now() + interval '2 days', now() + interval '2 days 1 hour', 1, 'https://meet.example.test/outside');
    raise exception 'A class outside its cycle must fail';
  exception when raise_exception then
    if sqlerrm <> 'A class must occur within its weekly cycle' then raise; end if;
  end;
end;
$$;

select pass('New classes are active immediately.');
select pass('A meeting link is mandatory.');
select pass('Class dates remain within the selected cycle.');
select * from finish();

rollback;
