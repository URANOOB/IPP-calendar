begin;

do $$
declare
  v_teacher_profile uuid := gen_random_uuid();
  v_manager_profile uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_guardian uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_hash text := encode(extensions.digest('waiting-room-test', 'sha256'), 'hex');
  v_now timestamptz := now();
begin
  if not has_function_privilege('service_role', 'public.claim_due_class_reminders(timestamp with time zone)', 'execute') then raise exception 'Service role must be able to claim reminders'; end if;
  update public.weekly_cycles set status = 'draft' where status = 'open';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (v_teacher_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reminder-teacher-' || v_teacher_profile || '@example.test', '', v_now, '{"provider":"email","providers":["email"]}', '{}', v_now, v_now),
    (v_manager_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reminder-manager-' || v_manager_profile || '@example.test', '', v_now, '{"provider":"email","providers":["email"]}', '{}', v_now, v_now);
  insert into public.profiles (id, role, full_name) values (v_teacher_profile, 'teacher', 'Profesor reminder'), (v_manager_profile, 'contact_manager', 'Gestor reminder');
  insert into public.teachers (id, profile_id, display_name) values (v_teacher, v_teacher_profile, 'Profesor reminder');
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status) values (v_cycle, 'Ciclo reminder', v_now - interval '1 day', v_now + interval '3 days', v_now - interval '2 days', v_now + interval '2 days', 'open');
  insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, meeting_url, status) values (v_class, v_cycle, v_teacher, 'Clase reminder', v_now + interval '24 hours', v_now + interval '25 hours', 4, 'https://meet.example.test/room', 'published');
  insert into public.guardians (id, full_name, phone, access_token_hash) values (v_guardian, 'Acudiente reminder', '+573107777771', v_hash);
  insert into public.students (id, guardian_id, full_name) values (v_student, v_guardian, 'Estudiante reminder');
  insert into public.registrations (student_id, class_id, cycle_id, status, confirmed_at) values (v_student, v_class, v_cycle, 'confirmed', v_now);
  insert into public.contact_tracking (guardian_id, assigned_to) values (v_guardian, v_manager_profile)
  on conflict (guardian_id) do update set assigned_to = excluded.assigned_to;

  if (select count(*) from public.claim_due_class_reminders(v_now)) <> 2 then raise exception 'Expected one 24h reminder for teacher and manager'; end if;
  if (select count(*) from public.claim_due_class_reminders(v_now)) <> 0 then raise exception 'Claiming twice must not duplicate reminders'; end if;
  if (select count(*) from public.class_reminders where class_id = v_class and status = 'processing') <> 2 then raise exception 'Expected both reminders to be processing'; end if;
  if (select public.get_guardian_meeting_access(v_hash, v_student, v_class)) is not null then raise exception 'Meeting link must be hidden more than 30 minutes before class'; end if;
  if (select classes::text like '%meet.example.test%' from public.get_guardian_waiting_room(v_hash)) then raise exception 'Waiting room must never expose meeting URL'; end if;
end;
$$;

rollback;
