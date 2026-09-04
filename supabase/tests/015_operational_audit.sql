-- Run against the local or linked database. ALL fixtures are rolled back.
begin;
do $$
<<audit>>
declare
  admin_id uuid; manager_id uuid; teacher_profile uuid := gen_random_uuid();
  teacher_id uuid; cycle_id uuid; class_id uuid; guardian_id uuid; student_id uuid; registration_id uuid;
  other_student uuid; test_phone text := '+573' || lpad((floor(random()*1000000000))::bigint::text,9,'0');
  start_time timestamptz;
begin
  select id into admin_id from public.profiles where role='admin' and active limit 1;
  select id into manager_id from public.profiles where role='manager' and active limit 1;
  if admin_id is null or manager_id is null then raise exception 'Requires active admin and manager'; end if;
  select greatest(now()+interval '30 days', coalesce(max(ends_at), now())+interval '30 days', coalesce(max(registration_closes_at), now())+interval '30 days') into start_time from public.weekly_cycles;
  insert into auth.users(id, email) values(teacher_profile, 'audit-'||teacher_profile||'@example.invalid');
  insert into public.profiles(id, full_name, role, active) values(teacher_profile, 'Audit teacher profile', 'manager', true);

  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  execute 'set local role authenticated';
  if not exists(select 1 from public.admin_teacher_candidates() c where c.profile_id=teacher_profile) then raise exception 'Manager cannot read teacher candidates'; end if;
  insert into public.teachers(profile_id, display_name) values(teacher_profile, 'Audit teacher') returning id into teacher_id;
  update public.teachers set display_name='Audit teacher edited', notification_email='audit@example.invalid' where id=audit.teacher_id;
  if not found then raise exception 'Manager cannot edit teacher'; end if;
  if not exists(select 1 from public.admin_teacher_directory() t where t.teacher_id=audit.teacher_id) then raise exception 'Manager cannot read teacher directory'; end if;
  insert into storage.objects(bucket_id, name) values('teacher-avatars', 'teacher/'||teacher_id||'/audit.png');
  if not exists(select 1 from storage.objects where bucket_id='teacher-avatars' and name='teacher/'||teacher_id||'/audit.png') then raise exception 'Manager cannot read avatar'; end if;

  insert into public.weekly_cycles(name, starts_at, ends_at, registration_opens_at, registration_closes_at, status)
  values('Audit cycle',start_time,start_time+interval '7 days',start_time-interval '1 day',start_time+interval '6 days','open') returning id into cycle_id;
  update public.weekly_cycles set name='Audit cycle edited' where id=audit.cycle_id;
  if not found then raise exception 'Manager cannot edit cycle'; end if;
  insert into public.classes(title, teacher_id, cycle_id, starts_at, ends_at, capacity, meeting_url, status)
  values('Audit class',teacher_id,cycle_id,start_time+interval '1 hour',start_time+interval '2 hours',4,'https://example.invalid/meeting','published') returning id into class_id;
  update public.classes set title='Audit class edited', capacity=2 where id=audit.class_id;
  if not found then raise exception 'Manager cannot edit class'; end if;

  guardian_id := public.create_pending_guardian(test_phone);
  update public.guardians set full_name='Audit guardian' where id=audit.guardian_id;
  if not found then raise exception 'Manager cannot edit contact'; end if;
  if not exists(select 1 from public.list_contact_guardians(test_phone, null, 25, 0) g where g.id=audit.guardian_id) then raise exception 'Contact search does not find phone'; end if;
  insert into public.students(guardian_id, full_name) values(guardian_id, 'Audit student') returning id into student_id;
  update public.students set full_name='Audit student edited',active=false where id=audit.student_id;
  update public.students set active=true where id=audit.student_id;
  if not found then raise exception 'Manager cannot reactivate student'; end if;
  insert into public.registrations(student_id,class_id,cycle_id,status) values(student_id,class_id,cycle_id,'pending') returning id into registration_id;
  perform public.record_class_attendance(class_id,jsonb_build_array(jsonb_build_object('registration_id',registration_id,'status','attended')));
  if not exists(select 1 from public.registrations r where r.id=audit.registration_id and r.status='attended') then raise exception 'Manager cannot record attendance'; end if;
  update public.contact_tracking set response_status='interested',first_contact_at=now() where contact_tracking.guardian_id=audit.guardian_id;
  insert into public.contact_events(guardian_id,actor_profile_id,event_type,metadata) values(guardian_id,manager_id,'note_added','{"note":"Audit note"}');
  perform public.update_class_reminder_settings(true,1440,true,180);

  -- Database integrity: duplicate phone, overlapping teacher slots and capacity.
  begin
    insert into public.guardians(phone) values(test_phone);
    raise exception 'Duplicate phone accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.classes(title,teacher_id,cycle_id,starts_at,ends_at,capacity,meeting_url,status)
    values('Audit overlap',teacher_id,cycle_id,start_time+interval '1 hour',start_time+interval '2 hours',4,'https://example.invalid/meeting','published');
    raise exception 'Teacher overlap accepted';
  exception when exclusion_violation then null; end;
  update public.classes set capacity=1 where id=audit.class_id;
  insert into public.students(guardian_id, full_name) values(guardian_id, 'Audit second student') returning id into other_student;
  begin
    insert into public.registrations(student_id,class_id,cycle_id,status) values(other_student,class_id,cycle_id,'pending');
    raise exception 'Overbooking accepted';
  exception when raise_exception then
    if sqlerrm not like '%llenarse%' then raise; end if;
  end;

  -- Managers cannot delete records or promote their account.
  delete from public.classes where id=audit.class_id;
  if found then raise exception 'Manager deleted class'; end if;
  begin perform public.delete_guardian(guardian_id); raise exception 'Manager deleted guardian through RPC';
  exception when raise_exception then if sqlerrm not like '%permisos%' then raise; end if; end;
  update public.profiles set role='admin' where id=manager_id;
  if found then raise exception 'Manager elevated role'; end if;
  execute 'reset role';

  -- A token with no active staff profile cannot bypass nullable role guards.
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  execute 'set local role authenticated';
  if public.is_admin() is distinct from false or public.is_manager() is distinct from false or public.is_internal_user() is distinct from false then
    raise exception 'Missing profile must resolve to false for every role helper';
  end if;
  begin perform public.delete_guardian(guardian_id); raise exception 'Missing profile bypassed delete guard';
  exception when raise_exception then if sqlerrm not like '%permisos%' then raise; end if; end;
  execute 'reset role';
  update public.profiles set active=false where id=teacher_profile;
  perform set_config('request.jwt.claim.sub',teacher_profile::text,true);
  execute 'set local role authenticated';
  begin perform public.create_pending_guardian('+573000000001'); raise exception 'Inactive profile bypassed create guard';
  exception when raise_exception then if sqlerrm not like '%permisos%' then raise; end if; end;
  execute 'reset role';
  update public.profiles set active=true where id=teacher_profile;

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  execute 'set local role authenticated';
  perform public.delete_student(other_student);
  perform public.delete_class(class_id);
  perform public.delete_cycle(cycle_id);
  perform public.delete_guardian(guardian_id);
  perform public.delete_teacher(teacher_id);
  if not exists(select 1 from public.profiles where id=teacher_profile) then raise exception 'Deleting teacher deleted staff profile'; end if;
  execute 'reset role';
end;
$$;
rollback;
