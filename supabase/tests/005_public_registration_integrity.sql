-- Execute after migrations. This verifies public booking validation as one transaction.
begin;

do $$
declare
  v_profile uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_one_seat_class uuid := gen_random_uuid();
  v_guardian uuid := gen_random_uuid();
  v_student_a uuid := gen_random_uuid();
  v_student_b uuid := gen_random_uuid();
  v_other_guardian uuid := gen_random_uuid();
  v_other_student uuid := gen_random_uuid();
  v_limited_guardian uuid := gen_random_uuid();
  v_limited_student_a uuid := gen_random_uuid();
  v_limited_student_b uuid := gen_random_uuid();
  v_hash text := encode(extensions.digest('public-booking-test', 'sha256'), 'hex');
begin
  update public.weekly_cycles set status = 'closed' where status = 'open';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'booking-' || v_profile || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into public.profiles (id, role, full_name) values (v_profile, 'teacher', 'Profesor de prueba');
  insert into public.teachers (id, profile_id, display_name) values (v_teacher, v_profile, 'Profesor de prueba');
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status)
  values (v_cycle, 'Ciclo público de prueba', now() - interval '1 day', now() + interval '6 days', now() - interval '1 hour', now() + interval '1 day', 'open');
  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, status)
  values (v_class, v_cycle, v_teacher, 'Clase con dos cupos', now() + interval '1 hour', now() + interval '2 hours', 2, 'published');
  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, status)
  values (v_one_seat_class, v_cycle, v_teacher, 'Clase con un cupo', now() + interval '3 hours', now() + interval '4 hours', 1, 'published');
  insert into public.guardians (id, full_name, phone) values
    (v_guardian, 'Acudiente de prueba', '+573109999991'),
    (v_other_guardian, 'Otra familia', '+573109999992'),
    (v_limited_guardian, 'Familia cupo limitado', '+573109999993');
  insert into public.students (id, guardian_id, full_name) values
    (v_student_a, v_guardian, 'Niño A'), (v_student_b, v_guardian, 'Niño B'), (v_other_student, v_other_guardian, 'Niño ajeno'),
    (v_limited_student_a, v_limited_guardian, 'Niño cupo A'), (v_limited_student_b, v_limited_guardian, 'Niño cupo B');
  insert into public.guardian_cycle_invitations (guardian_id, cycle_id, token_hash) values
    (v_guardian, v_cycle, v_hash), (v_other_guardian, v_cycle, encode(extensions.digest('other-test', 'sha256'), 'hex')), (v_limited_guardian, v_cycle, encode(extensions.digest('limited-test', 'sha256'), 'hex'));

  perform public.book_guardian_classes(v_hash, jsonb_build_array(jsonb_build_object('student_id', v_student_a, 'class_id', v_class), jsonb_build_object('student_id', v_student_b, 'class_id', v_class)));
  if (select count(*) from public.registrations where class_id = v_class) <> 2 then raise exception 'Expected two registrations'; end if;

  begin
    perform public.book_guardian_classes(encode(extensions.digest('limited-test', 'sha256'), 'hex'), jsonb_build_array(jsonb_build_object('student_id', v_limited_student_a, 'class_id', v_one_seat_class), jsonb_build_object('student_id', v_limited_student_b, 'class_id', v_one_seat_class)));
    raise exception 'Expected insufficient capacity failure';
  exception when raise_exception then
    if sqlerrm <> 'Esta clase acaba de llenarse.' then raise; end if;
  end;
  if exists (select 1 from public.registrations where class_id = v_one_seat_class) then raise exception 'A failed family booking must not be partial'; end if;

  begin
    perform public.book_guardian_classes(v_hash, jsonb_build_array(jsonb_build_object('student_id', v_student_a, 'class_id', v_class)));
    raise exception 'Expected duplicate student validation failure';
  exception when raise_exception then
    if sqlerrm <> 'Uno de tus niños ya tiene una clase programada esta semana.' then raise; end if;
  end;

  begin
    perform public.book_guardian_classes(v_hash, jsonb_build_array(jsonb_build_object('student_id', v_other_student, 'class_id', v_class)));
    raise exception 'Expected foreign student validation failure';
  exception when raise_exception then
    if sqlerrm <> 'No pudimos completar la inscripción. Revisa las clases seleccionadas.' then raise; end if;
  end;
end;
$$;

rollback;
