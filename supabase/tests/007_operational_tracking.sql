begin;

do $$
declare
  v_admin uuid := gen_random_uuid(); v_teacher_profile uuid := gen_random_uuid(); v_teacher uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid(); v_class uuid := gen_random_uuid(); v_guardian uuid := gen_random_uuid(); v_student uuid := gen_random_uuid(); v_registration uuid := gen_random_uuid();
begin
  update public.weekly_cycles set status = 'draft' where status = 'open';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tracking-admin-' || v_admin || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_teacher_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tracking-teacher-' || v_teacher_profile || '@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
  insert into public.profiles (id, role, full_name) values (v_admin, 'admin', 'Admin tracking'), (v_teacher_profile, 'teacher', 'Profesor tracking');
  insert into public.teachers (id, profile_id, display_name) values (v_teacher, v_teacher_profile, 'Profesor tracking');
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status) values (v_cycle, 'Ciclo tracking', now() - interval '1 day', now() + interval '3 days', now() - interval '1 day', now() + interval '2 days', 'open');
  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, status) values (v_class, v_cycle, v_teacher, 'Clase tracking', now() + interval '1 hour', now() + interval '2 hours', 5, 'published');
  insert into public.guardians (id, full_name, phone) values (v_guardian, 'Acudiente tracking', '+573106666661');
  if not exists (select 1 from public.contact_tracking where guardian_id = v_guardian) then raise exception 'Tracking row must be created with guardian'; end if;
  insert into public.students (id, guardian_id, full_name) values (v_student, v_guardian, 'Estudiante tracking');
  insert into public.registrations (id, student_id, class_id, cycle_id, status, confirmed_at) values (v_registration, v_student, v_class, v_cycle, 'confirmed', now());
  if not exists (select 1 from public.contact_events where guardian_id = v_guardian and event_type = 'booking_created') then raise exception 'Booking must create audit event'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true); perform public.record_class_attendance(v_class, jsonb_build_array(jsonb_build_object('registration_id', v_registration, 'status', 'attended')));
  if (select status from public.registrations where id = v_registration) <> 'attended' then raise exception 'Attendance was not saved'; end if;
  if not exists (select 1 from public.contact_events where guardian_id = v_guardian and event_type = 'attendance_updated') then raise exception 'Attendance must create audit event'; end if;
end;
$$;

rollback;
