-- Run this entire script in the Supabase SQL Editor as a database administrator.
-- It is self-contained, creates only temporary test data, and rolls it back at the end.

begin;

do $$
declare
  v_auth_user_id uuid := gen_random_uuid();
  v_teacher_id uuid := gen_random_uuid();
  v_guardian_id uuid := gen_random_uuid();
  v_student_id uuid := gen_random_uuid();
  v_cycle_a_id uuid := gen_random_uuid();
  v_cycle_b_id uuid := gen_random_uuid();
  v_class_a_id uuid := gen_random_uuid();
  v_class_b_id uuid := gen_random_uuid();
begin
  -- The test user exists only for satisfying profiles -> auth.users -> teachers relations.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_auth_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'integrity-' || v_auth_user_id || '@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

  insert into public.profiles (id, role, full_name)
  values (v_auth_user_id, 'teacher', 'Profesor de integridad');
  insert into public.teachers (id, profile_id, display_name)
  values (v_teacher_id, v_auth_user_id, 'Profesor de integridad');

  insert into public.guardians (id, full_name, phone)
  values (v_guardian_id, 'Acudiente de prueba', '+573009999999');

  begin
    insert into public.guardians (full_name, phone) values ('Teléfono duplicado', '+573009999999');
    raise exception 'Expected duplicate guardian phone to fail';
  exception when unique_violation then null;
  end;

  insert into public.students (id, guardian_id, full_name)
  values (v_student_id, v_guardian_id, 'Estudiante de prueba');

  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at)
  values (v_cycle_a_id, 'Ciclo de prueba A', now() + interval '100 years 7 days', now() + interval '100 years 14 days', now() + interval '100 years', now() + interval '100 years 6 days');

  begin
    insert into public.weekly_cycles (name, starts_at, ends_at, registration_opens_at, registration_closes_at)
    values ('Ciclo inválido', now() + interval '100 years', now() + interval '100 years -7 days', now() + interval '100 years', now() + interval '100 years -1 hour');
    raise exception 'Expected invalid cycle dates to fail';
  exception when check_violation then null;
  end;

  begin
    insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity)
    values (v_cycle_a_id, v_teacher_id, 'Sin cupos', now() + interval '100 years 8 days', now() + interval '100 years 8 days 1 hour', 0);
    raise exception 'Expected zero class capacity to fail';
  exception when check_violation then null;
  end;

  begin
    insert into public.classes (cycle_id, teacher_id, title, starts_at, ends_at, capacity)
    values (v_cycle_a_id, v_teacher_id, 'Horario inválido', now() + interval '100 years 8 days', now() + interval '100 years 7 days', 10);
    raise exception 'Expected reversed class dates to fail';
  exception when check_violation then null;
  end;

  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity)
  values (v_class_a_id, v_cycle_a_id, v_teacher_id, 'Clase de prueba A', now() + interval '100 years 8 days', now() + interval '100 years 8 days 1 hour', 10);

  insert into public.registrations (student_id, class_id, cycle_id, status)
  values (v_student_id, v_class_a_id, v_cycle_a_id, 'pending');

  begin
    insert into public.registrations (student_id, class_id, cycle_id, status)
    values (v_student_id, v_class_a_id, v_cycle_a_id, 'pending');
    raise exception 'Expected duplicate registration in a cycle to fail';
  exception when unique_violation then null;
  end;

  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at)
  values (v_cycle_b_id, 'Ciclo de prueba B', now() + interval '100 years 14 days', now() + interval '100 years 21 days', now() + interval '100 years 7 days', now() + interval '100 years 13 days');
  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity)
  values (v_class_b_id, v_cycle_b_id, v_teacher_id, 'Clase de prueba B', now() + interval '100 years 15 days', now() + interval '100 years 15 days 1 hour', 10);
  insert into public.registrations (student_id, class_id, cycle_id, status)
  values (v_student_id, v_class_b_id, v_cycle_b_id, 'pending');
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename in ('profiles', 'teachers', 'guardians', 'students', 'weekly_cycles', 'classes', 'registrations', 'contact_tracking')
      and rowsecurity is false
  ) then
    raise exception 'Expected RLS to be enabled on every public IPP table';
  end if;
end;
$$;

rollback;
