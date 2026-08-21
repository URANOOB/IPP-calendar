-- Run in the Supabase SQL Editor or with psql against local Supabase.
begin;

do $$
declare
  v_profile_a uuid := gen_random_uuid();
  v_profile_b uuid := gen_random_uuid();
  v_teacher_a uuid := gen_random_uuid();
  v_teacher_b uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_profile_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'class-a-' || v_profile_a || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_profile_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'class-b-' || v_profile_b || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into public.profiles (id, role, full_name) values (v_profile_a, 'teacher', 'Profesor A'), (v_profile_b, 'teacher', 'Profesor B');
  insert into public.teachers (id, profile_id, display_name) values (v_teacher_a, v_profile_a, 'Profesor A'), (v_teacher_b, v_profile_b, 'Profesor B');
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at)
  values (v_cycle, 'Ciclo de clases', '2050-01-01 05:00:00+00', '2050-01-08 05:00:00+00', '2049-12-29 05:00:00+00', '2050-01-07 05:00:00+00');
  insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity)
  values (v_cycle, v_teacher_a, 'Clase A', '2050-01-03 21:00:00+00', '2050-01-03 22:00:00+00', 10);
  begin
    insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity)
    values (v_cycle, v_teacher_a, 'Clase solapada', '2050-01-03 21:30:00+00', '2050-01-03 22:30:00+00', 10);
    raise exception 'Expected overlapping teacher class to fail';
  exception when exclusion_violation then null;
  end;
  insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity)
  values (v_cycle, v_teacher_b, 'Clase simultánea', '2050-01-03 21:00:00+00', '2050-01-03 22:00:00+00', 10);
  begin
    insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity)
    values (v_cycle, v_teacher_a, 'Fuera de ciclo', '2050-01-09 21:00:00+00', '2050-01-09 22:00:00+00', 10);
    raise exception 'Expected class outside cycle to fail';
  exception when raise_exception then
    if sqlerrm <> 'A class must occur within its weekly cycle' then raise; end if;
  end;
end;
$$;

rollback;
