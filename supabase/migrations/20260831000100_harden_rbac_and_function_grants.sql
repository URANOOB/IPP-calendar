-- Canonical access matrix:
--   admin   -> CRUD on every operational record
--   manager -> create, read and update operational records; never delete
-- Profiles/roles remain admin-only so a manager cannot promote an account.

begin;

do $$
declare
  policy_record record;
  table_name text;
  function_record record;
begin
  -- The linked database accumulated policies from multiple authorization
  -- versions. RLS policies are additive, so leave one canonical set only.
  for policy_record in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'teachers', 'guardians', 'students', 'weekly_cycles',
        'classes', 'registrations', 'contact_tracking', 'contact_events',
        'guardian_cycle_invitations', 'class_reminders',
        'class_reminder_settings', 'platform_activity'
      )
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;

  foreach table_name in array array[
    'profiles', 'teachers', 'guardians', 'students', 'weekly_cycles',
    'classes', 'registrations', 'contact_tracking', 'contact_events',
    'guardian_cycle_invitations', 'class_reminders',
    'class_reminder_settings', 'platform_activity'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      'admin full access', table_name
    );
  end loop;

  -- An authenticated manager can operate on every business record, but has no
  -- DELETE policy. The absence of a DELETE policy is intentional and tested.
  foreach table_name in array array[
    'teachers', 'guardians', 'students', 'weekly_cycles', 'classes',
    'registrations', 'contact_tracking', 'contact_events',
    'guardian_cycle_invitations'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_manager())', 'manager reads', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_manager())', 'manager creates', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_manager()) with check (public.is_manager())', 'manager updates', table_name);
  end loop;

  create policy "manager reads own profile" on public.profiles
    for select to authenticated using (id = auth.uid() and public.is_manager());

  create policy "manager reads own reminders" on public.class_reminders
    for select to authenticated using (recipient_profile_id = auth.uid() and public.is_manager());

  create policy "manager reads reminder settings" on public.class_reminder_settings
    for select to authenticated using (public.is_manager());
  create policy "manager updates reminder settings" on public.class_reminder_settings
    for update to authenticated using (public.is_manager()) with check (public.is_manager());

  create policy "manager reads activity" on public.platform_activity
    for select to authenticated using (public.is_manager());

  -- Direct table privileges are required by PostgREST, while RLS above is the
  -- actual authorization layer. Anonymous users receive no table privileges.
  revoke all on all tables in schema public from public, anon;
  revoke all on all tables in schema public from authenticated;
  grant select, insert, update, delete on public.profiles, public.teachers,
    public.guardians, public.students, public.weekly_cycles, public.classes,
    public.registrations, public.contact_tracking, public.contact_events,
    public.guardian_cycle_invitations, public.class_reminders,
    public.class_reminder_settings, public.platform_activity to authenticated;

  -- PostgreSQL grants EXECUTE to PUBLIC by default. Revoke it from every
  -- exposed function, then explicitly grant only the application entrypoints.
  for function_record in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', function_record.signature);
  end loop;
end;
$$;

-- Public guardian flows, protected by their high-entropy access tokens.
grant execute on function public.get_general_registration_welcome() to anon, authenticated;
grant execute on function public.activate_guardian_cycle_access(text, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.get_guardian_registration_context(text) to anon, authenticated;
grant execute on function public.get_guardian_waiting_room(text) to anon, authenticated;
grant execute on function public.get_guardian_meeting_access(text, uuid, uuid) to anon, authenticated;
grant execute on function public.book_guardian_classes(text, jsonb, text) to anon, authenticated;

-- Dashboard RPCs enforce their own role checks or are reached only after the
-- dashboard's server-side role check.
grant execute on function public.admin_teacher_directory() to authenticated;
grant execute on function public.admin_teacher_candidates() to authenticated;
-- These helpers are evaluated by RLS policies for authenticated requests.
grant execute on function public.current_user_role(), public.is_admin(), public.is_manager(),
  public.is_internal_user(), public.current_teacher_id(), public.is_contact_manager() to authenticated;
grant execute on function public.list_contact_guardians(text, boolean, integer, integer) to authenticated;
grant execute on function public.create_guardian_with_students(text, text, jsonb) to authenticated;
grant execute on function public.create_pending_guardian(text) to authenticated;
grant execute on function public.create_guardian_cycle_invitation(uuid, uuid, text) to authenticated;
grant execute on function public.record_class_attendance(uuid, jsonb) to authenticated;
grant execute on function public.update_class_reminder_settings(boolean, integer, boolean, integer) to authenticated;
grant execute on function public.delete_guardian(uuid), public.delete_student(uuid),
  public.delete_class(uuid), public.delete_cycle(uuid), public.delete_teacher(uuid) to authenticated;

-- Reminder processing is callable only by the Edge Function service account.
grant execute on function public.claim_due_class_reminders(timestamptz),
  public.complete_class_reminder(uuid, text), public.fail_class_reminder(uuid, text),
  public.complete_due_classes(timestamptz), public.invoke_class_reminder_function() to service_role;

create or replace function public.create_guardian_cycle_invitation(
  p_guardian_id uuid,
  p_cycle_id uuid,
  p_token_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_internal_user() then
    raise exception 'No tienes permisos para generar invitaciones.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.guardians where id = p_guardian_id and active) then
    raise exception 'El acudiente no está activo.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.students where guardian_id = p_guardian_id and active) then
    raise exception 'El acudiente debe tener al menos un estudiante activo.' using errcode = 'P0001';
  end if;

  insert into public.guardian_cycle_invitations (guardian_id, cycle_id, token_hash, created_by)
  values (p_guardian_id, p_cycle_id, p_token_hash, auth.uid());
  update public.contact_tracking set invitation_sent_at = now() where guardian_id = p_guardian_id;
  insert into public.contact_events (guardian_id, actor_profile_id, event_type, metadata)
  values (p_guardian_id, auth.uid(), 'invitation_sent', jsonb_build_object('cycle_id', p_cycle_id));
end;
$$;

create or replace function public.record_class_attendance(p_class_id uuid, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_valid integer;
  v_entry record;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'La asistencia no pudo guardarse.' using errcode = 'P0001';
  end if;
  if not public.is_internal_user() then
    raise exception 'No tienes permisos para registrar asistencia.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_entries) item
    where coalesce(item->>'registration_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or item->>'status' not in ('attended', 'absent')
  ) then
    raise exception 'La asistencia no pudo guardarse.' using errcode = 'P0001';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_entries);
  select count(*) into v_valid
  from public.registrations r
  join jsonb_array_elements(p_entries) item on r.id = (item->>'registration_id')::uuid
  where r.class_id = p_class_id and r.status in ('pending', 'confirmed', 'attended', 'absent');
  if v_count <> v_valid then
    raise exception 'No tienes permisos para registrar asistencia.' using errcode = 'P0001';
  end if;

  for v_entry in
    select (item->>'registration_id')::uuid as registration_id, item->>'status' as status
    from jsonb_array_elements(p_entries) item
  loop
    update public.registrations
    set status = v_entry.status::public.registration_status,
        attendance_marked_at = now(),
        attendance_marked_by = v_user_id
    where id = v_entry.registration_id;
    insert into public.contact_events (guardian_id, actor_profile_id, event_type, metadata)
    select s.guardian_id, v_user_id, 'attendance_updated',
      jsonb_build_object('registration_id', r.id, 'class_id', r.class_id, 'status', v_entry.status)
    from public.registrations r
    join public.students s on s.id = r.student_id
    where r.id = v_entry.registration_id;
  end loop;
end;
$$;

-- Deleting a teacher removes their operational record and dependent classes,
-- never the staff account/profile. This prevents a deletion from locking a
-- dashboard administrator or manager out of the platform.
create or replace function public.delete_teacher(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No tienes permisos para eliminar profesores.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'El profesor no existe.' using errcode = 'P0001';
  end if;

  delete from public.class_reminders where class_id in (select id from public.classes where teacher_id = p_teacher_id);
  delete from public.registrations where class_id in (select id from public.classes where teacher_id = p_teacher_id);
  delete from public.classes where teacher_id = p_teacher_id;
  delete from public.teachers where id = p_teacher_id;
end;
$$;

revoke all on function public.delete_teacher(uuid) from public, anon;
grant execute on function public.delete_teacher(uuid) to authenticated;

commit;
