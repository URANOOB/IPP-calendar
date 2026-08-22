begin;

select plan(1);

do $$
declare
  v_profile uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid();
  v_guardian uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_token_hash text := encode(extensions.digest('optional-name-' || gen_random_uuid()::text, 'sha256'), 'hex');
begin
  update public.weekly_cycles set status = 'closed' where status = 'open';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'optional-name-' || v_profile || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into public.profiles (id, role, full_name) values (v_profile, 'teacher', 'Profesor de prueba');
  insert into public.teachers (id, profile_id, display_name) values (v_teacher, v_profile, 'Profesor de prueba');
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status)
  values (v_cycle, 'Ciclo de prueba', now() - interval '1 day', now() + interval '2 days', now() - interval '1 hour', now() + interval '1 day', 'open');

  insert into public.guardians (id, phone) values (v_guardian, '+573109999999');
  if (select full_name is not null from public.guardians where id = v_guardian) then
    raise exception 'Guardian name must be optional';
  end if;

  insert into public.students (id, guardian_id, full_name) values (v_student, v_guardian, 'Estudiante de prueba');
  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, status)
  values (v_class, v_cycle, v_teacher, 'Clase de prueba', now() + interval '2 hours', now() + interval '3 hours', 1, 'published');
  insert into public.guardian_cycle_invitations (guardian_id, cycle_id, token_hash)
  values (v_guardian, v_cycle, v_token_hash);

  perform public.book_guardian_classes(v_token_hash, jsonb_build_array(jsonb_build_object('student_id', v_student, 'class_id', v_class)), '  Laura  ');
  if (select full_name from public.guardians where id = v_guardian) is not null then
    raise exception 'Booking must not edit guardian information';
  end if;
end;
$$;

select pass('Booking classes cannot edit guardian information.');
select * from finish();

rollback;
