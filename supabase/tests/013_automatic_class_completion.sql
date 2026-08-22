begin;

select plan(2);

do $$
declare
  v_profile uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_completed integer;
  v_status public.class_status;
begin
  update public.weekly_cycles set status = 'closed' where status = 'open';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'completed-class-' || v_profile || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into public.profiles (id, role, full_name) values (v_profile, 'teacher', 'Profesor de prueba');
  insert into public.teachers (id, profile_id, display_name) values (v_teacher, v_profile, 'Profesor de prueba');
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status)
  values (v_cycle, 'Ciclo finalizable', now() - interval '1 day', now() + interval '1 day', now() - interval '2 days', now() + interval '12 hours', 'open');
  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, meeting_url, status)
  values (v_class, v_cycle, v_teacher, 'Clase terminada', now() - interval '1 hour', now() + interval '30 seconds', 1, 'https://meet.example.test/completed', 'published');

  v_completed := public.complete_due_classes(now() + interval '2 minutes');
  select status into v_status from public.classes where id = v_class;
  if v_completed < 1 or v_status <> 'completed' then
    raise exception 'A class must complete one minute after its end time (completed: %, status: %)', v_completed, v_status;
  end if;

  begin
    update public.classes set status = 'cancelled' where id = v_class;
    raise exception 'Classes cannot be cancelled';
  exception when check_violation then null;
  end;
end;
$$;

select pass('Classes are finalized automatically after their end time.');
select pass('Classes cannot be cancelled.');
select * from finish();

rollback;
