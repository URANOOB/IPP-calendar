-- Migration 2: Use 'manager' role - migrate data, update functions, RLS, RPCs
-- This runs after the enum value is committed.

-- 1. Migrate existing contact_manager users to manager
update public.profiles
set role = 'manager'
where role = 'contact_manager';

-- 2. Create is_manager() function
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'manager';
$$;

revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;

-- 3. Update is_internal_user() to include admin and manager (not teacher or contact_manager)
create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'manager');
$$;

-- 4. Update RLS policies for all tables
-- profiles: admin manages, staff reads own profile
drop policy if exists "profiles: staff reads own profile" on public.profiles;
drop policy if exists "profiles: admin manages" on public.profiles;

create policy "profiles: staff reads own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "profiles: admin selects" on public.profiles
for select to authenticated using (public.is_admin());

create policy "profiles: admin inserts" on public.profiles
for insert to authenticated with check (public.is_admin());

create policy "profiles: admin updates" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "profiles: admin deletes" on public.profiles
for delete to authenticated using (public.is_admin());

-- teachers: admin and manager can read/insert/update, admin only delete
drop policy if exists "teachers: staff reads" on public.teachers;
drop policy if exists "teachers: admin manages" on public.teachers;

create policy "teachers: admin manager reads" on public.teachers
for select to authenticated using (public.is_internal_user());

create policy "teachers: admin manager inserts" on public.teachers
for insert to authenticated with check (public.is_internal_user());

create policy "teachers: admin manager updates" on public.teachers
for update to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

create policy "teachers: admin deletes" on public.teachers
for delete to authenticated using (public.is_admin());

-- guardians: admin and manager full CRUD
drop policy if exists "guardians: admin manages" on public.guardians;
drop policy if exists "guardians: contact manager reads" on public.guardians;
drop policy if exists "guardians: contact manager inserts" on public.guardians;
drop policy if exists "guardians: contact manager updates" on public.guardians;
drop policy if exists "guardians: manager reads assigned or unassigned" on public.guardians;
drop policy if exists "guardians: manager updates assigned or unassigned" on public.guardians;
drop policy if exists "guardians: teacher reads enrolled" on public.guardians;

create policy "guardians: admin manager reads" on public.guardians
for select to authenticated using (public.is_internal_user());

create policy "guardians: admin manager inserts" on public.guardians
for insert to authenticated with check (public.is_internal_user());

create policy "guardians: admin manager updates" on public.guardians
for update to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

create policy "guardians: admin deletes" on public.guardians
for delete to authenticated using (public.is_admin());

-- students: admin and manager full CRUD
drop policy if exists "students: admin manages" on public.students;
drop policy if exists "students: contact manager reads" on public.students;
drop policy if exists "students: contact manager inserts" on public.students;
drop policy if exists "students: contact manager updates" on public.students;
drop policy if exists "students: manager reads assigned or unassigned" on public.students;
drop policy if exists "students: manager updates assigned or unassigned" on public.students;
drop policy if exists "students: teacher reads enrolled" on public.students;

create policy "students: admin manager reads" on public.students
for select to authenticated using (public.is_internal_user());

create policy "students: admin manager inserts" on public.students
for insert to authenticated with check (public.is_internal_user());

create policy "students: admin manager updates" on public.students
for update to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

create policy "students: admin deletes" on public.students
for delete to authenticated using (public.is_admin());

-- weekly_cycles: admin and manager read/insert/update, admin only delete
drop policy if exists "weekly cycles: internal staff reads" on public.weekly_cycles;
drop policy if exists "weekly cycles: admin manages" on public.weekly_cycles;

create policy "weekly cycles: admin manager reads" on public.weekly_cycles
for select to authenticated using (public.is_internal_user());

create policy "weekly cycles: admin manager inserts" on public.weekly_cycles
for insert to authenticated with check (public.is_internal_user());

create policy "weekly cycles: admin manager updates" on public.weekly_cycles
for update to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

create policy "weekly cycles: admin deletes" on public.weekly_cycles
for delete to authenticated using (public.is_admin());

-- classes: admin and manager full CRUD, teacher reads own
drop policy if exists "classes: admin manages" on public.classes;
drop policy if exists "classes: contact manager reads" on public.classes;
drop policy if exists "classes: teacher reads own" on public.classes;
drop policy if exists "classes: teacher updates own" on public.classes;

create policy "classes: admin manager reads" on public.classes
for select to authenticated using (public.is_internal_user());

create policy "classes: admin manager inserts" on public.classes
for insert to authenticated with check (public.is_internal_user());

create policy "classes: admin manager updates" on public.classes
for update to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

create policy "classes: admin deletes" on public.classes
for delete to authenticated using (public.is_admin());

create policy "classes: teacher reads own" on public.classes
for select to authenticated using (teacher_id = public.current_teacher_id());

-- registrations: admin and manager full CRUD
drop policy if exists "registrations: admin manages" on public.registrations;
drop policy if exists "registrations: contact manager reads" on public.registrations;
drop policy if exists "registrations: contact manager inserts" on public.registrations;
drop policy if exists "registrations: contact manager updates" on public.registrations;
drop policy if exists "registrations: teacher reads own classes" on public.registrations;

create policy "registrations: admin manager reads" on public.registrations
for select to authenticated using (public.is_internal_user());

create policy "registrations: admin manager inserts" on public.registrations
for insert to authenticated with check (public.is_internal_user());

create policy "registrations: admin manager updates" on public.registrations
for update to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

create policy "registrations: admin deletes" on public.registrations
for delete to authenticated using (public.is_admin());

create policy "registrations: teacher reads own classes" on public.registrations
for select to authenticated using (
  exists (select 1 from public.classes c where c.id = registrations.class_id and c.teacher_id = public.current_teacher_id())
);

-- contact_tracking: admin and manager full CRUD
drop policy if exists "contact tracking: admin manages" on public.contact_tracking;
drop policy if exists "contact tracking: contact manager reads" on public.contact_tracking;
drop policy if exists "contact tracking: contact manager inserts" on public.contact_tracking;
drop policy if exists "contact tracking: contact manager updates" on public.contact_tracking;
drop policy if exists "contact tracking: manager reads assigned or unassigned" on public.contact_tracking;
drop policy if exists "contact tracking: manager updates assigned or unassigned" on public.contact_tracking;

create policy "contact tracking: admin manager reads" on public.contact_tracking
for select to authenticated using (public.is_internal_user());

create policy "contact tracking: admin manager inserts" on public.contact_tracking
for insert to authenticated with check (public.is_internal_user());

create policy "contact tracking: admin manager updates" on public.contact_tracking
for update to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

create policy "contact tracking: admin deletes" on public.contact_tracking
for delete to authenticated using (public.is_admin());

-- class_reminder_settings: admin and manager reads/updates
drop policy if exists "class reminder settings: admin reads" on public.class_reminder_settings;

create policy "class reminder settings: admin manager reads" on public.class_reminder_settings
for select to authenticated using (public.is_internal_user());

create or replace function public.update_class_reminder_settings(
  p_first_enabled boolean,
  p_first_lead_minutes integer,
  p_second_enabled boolean,
  p_second_lead_minutes integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_internal_user() then
    raise exception 'No tienes permisos para configurar recordatorios.' using errcode = '42501';
  end if;

  if p_first_lead_minutes not in (15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440)
    or p_second_lead_minutes not in (15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440) then
    raise exception 'La anticipación del recordatorio no es válida.' using errcode = '22023';
  end if;

  if p_first_enabled and p_second_enabled and p_first_lead_minutes = p_second_lead_minutes then
    raise exception 'Los dos recordatorios activos deben tener anticipaciones diferentes.' using errcode = '22023';
  end if;

  insert into public.class_reminder_settings (singleton, first_enabled, first_lead_minutes, second_enabled, second_lead_minutes)
  values (true, p_first_enabled, p_first_lead_minutes, p_second_enabled, p_second_lead_minutes)
  on conflict (singleton) do update set
    first_enabled = excluded.first_enabled,
    first_lead_minutes = excluded.first_lead_minutes,
    second_enabled = excluded.second_enabled,
    second_lead_minutes = excluded.second_lead_minutes;

  delete from public.class_reminders r
  using public.classes c
  where c.id = r.class_id
    and c.starts_at > now()
    and r.reminder_type in ('teacher_24h', 'teacher_3h')
    and r.status in ('pending', 'failed');
end;
$$;

revoke all on function public.update_class_reminder_settings(boolean, integer, boolean, integer) from public;
grant execute on function public.update_class_reminder_settings(boolean, integer, boolean, integer) to authenticated;

-- 5. Update delete RPCs to check is_admin() only
create or replace function public.delete_guardian(p_guardian_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No tienes permisos para eliminar este acudiente.' using errcode = 'P0001'; end if;
  delete from public.registrations where student_id in (select id from public.students where guardian_id = p_guardian_id);
  delete from public.guardian_cycle_invitations where guardian_id = p_guardian_id;
  delete from public.contact_events where guardian_id = p_guardian_id;
  delete from public.contact_tracking where guardian_id = p_guardian_id;
  delete from public.students where guardian_id = p_guardian_id;
  delete from public.guardians where id = p_guardian_id;
  if not found then raise exception 'El acudiente no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_student(p_student_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No tienes permisos para eliminar este estudiante.' using errcode = 'P0001'; end if;
  delete from public.registrations where student_id = p_student_id;
  delete from public.students where id = p_student_id;
  if not found then raise exception 'El estudiante no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_class(p_class_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No tienes permisos para eliminar esta clase.' using errcode = 'P0001'; end if;
  delete from public.class_reminders where class_id = p_class_id;
  delete from public.registrations where class_id = p_class_id;
  delete from public.classes where id = p_class_id;
  if not found then raise exception 'La clase no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_cycle(p_cycle_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No tienes permisos para eliminar ciclos.' using errcode = 'P0001'; end if;
  delete from public.guardian_cycle_invitations where cycle_id = p_cycle_id;
  delete from public.class_reminders where class_id in (select id from public.classes where cycle_id=p_cycle_id);
  delete from public.registrations where cycle_id = p_cycle_id;
  delete from public.classes where cycle_id = p_cycle_id;
  delete from public.weekly_cycles where id = p_cycle_id;
  if not found then raise exception 'El ciclo no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_teacher(p_teacher_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if not public.is_admin() then raise exception 'No tienes permisos para eliminar profesores.' using errcode = 'P0001'; end if;
  select profile_id into v_profile_id from public.teachers where id=p_teacher_id for update;
  if v_profile_id is null then raise exception 'El profesor no existe.' using errcode = 'P0001'; end if;
  delete from public.class_reminders where class_id in (select id from public.classes where teacher_id=p_teacher_id);
  delete from public.registrations where class_id in (select id from public.classes where teacher_id=p_teacher_id);
  delete from public.classes where teacher_id = p_teacher_id;
  delete from public.teachers where id = p_teacher_id;
  delete from auth.users where id = v_profile_id;
end; $$;

-- 6. Remove teacher role enforcement triggers (teachers no longer need profile role = 'teacher')
drop trigger if exists teachers_require_teacher_profile on public.teachers;
drop trigger if exists profiles_keep_teacher_role on public.profiles;

-- Update the trigger functions to not enforce teacher role
create or replace function public.enforce_teacher_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = new.profile_id and active
  ) then
    raise exception 'A teacher must reference an active profile';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_teacher_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  return new;
end;
$$;

-- Re-create the trigger for profile_id validation only
create trigger teachers_require_teacher_profile
before insert or update of profile_id on public.teachers
for each row execute function public.enforce_teacher_profile_role();

-- 7. Update claim_due_class_reminders to use manager role instead of contact_manager
drop function if exists public.claim_due_class_reminders(timestamptz);
create function public.claim_due_class_reminders(p_now timestamptz default now())
returns table (
  reminder_id uuid,
  reminder_type public.class_reminder_type,
  recipient_email text,
  recipient_name text,
  class_id uuid,
  class_title text,
  class_starts_at timestamptz,
  class_ends_at timestamptz,
  teacher_name text,
  student_count integer,
  guardian_count integer,
  lead_minutes integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.class_reminders r
  set status = 'cancelled'
  from public.classes c
  where c.id = r.class_id and c.status = 'cancelled' and r.status in ('pending', 'failed');

  update public.class_reminders
  set status = 'failed', last_error = 'El procesamiento anterior no finalizó.'
  where status = 'processing' and updated_at < p_now - interval '20 minutes' and attempts < 3;

  with settings as (
    select first_enabled, first_lead_minutes, second_enabled, second_lead_minutes
    from public.class_reminder_settings where singleton
  ), recipients as (
    select c.id as class_id, p.id as recipient_profile_id, 'teacher_24h'::public.class_reminder_type as reminder_type,
      c.starts_at - make_interval(mins => settings.first_lead_minutes) as scheduled_for, settings.first_lead_minutes as lead_minutes
    from public.classes c join public.teachers t on t.id = c.teacher_id join public.profiles p on p.id = t.profile_id and p.active cross join settings
    where c.status = 'published' and settings.first_enabled
      and c.starts_at between p_now + make_interval(mins => settings.first_lead_minutes - 15) and p_now + make_interval(mins => settings.first_lead_minutes + 15)
    union all
    select c.id, p.id, 'teacher_3h'::public.class_reminder_type,
      c.starts_at - make_interval(mins => settings.second_lead_minutes), settings.second_lead_minutes
    from public.classes c join public.teachers t on t.id = c.teacher_id join public.profiles p on p.id = t.profile_id and p.active cross join settings
    where c.status = 'published' and settings.second_enabled
      and c.starts_at between p_now + make_interval(mins => settings.second_lead_minutes - 15) and p_now + make_interval(mins => settings.second_lead_minutes + 15)
    union all
    select distinct c.id, p.id, 'manager_24h'::public.class_reminder_type, c.starts_at - interval '24 hours', 1440
    from public.classes c join public.registrations r on r.class_id = c.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      join public.students s on s.id = r.student_id join public.contact_tracking ct on ct.guardian_id = s.guardian_id
      join public.profiles p on p.id = ct.assigned_to and p.role = 'manager' and p.active
    where c.status = 'published' and c.starts_at between p_now + interval '21 hours' and p_now + interval '24 hours 15 minutes'
    union all
    select distinct c.id, p.id, 'manager_3h'::public.class_reminder_type, c.starts_at - interval '3 hours', 180
    from public.classes c join public.registrations r on r.class_id = c.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      join public.students s on s.id = r.student_id join public.contact_tracking ct on ct.guardian_id = s.guardian_id
      join public.profiles p on p.id = ct.assigned_to and p.role = 'manager' and p.active
    where c.status = 'published' and c.starts_at between p_now + interval '2 hours' and p_now + interval '3 hours 15 minutes'
  )
  insert into public.class_reminders (class_id, recipient_profile_id, reminder_type, scheduled_for, lead_minutes)
  select class_id, recipient_profile_id, reminder_type, scheduled_for, lead_minutes from recipients
  on conflict on constraint class_reminders_one_recipient_per_type_key do nothing;

  return query
  with candidates as (
    select r.id
    from public.class_reminders r
    join public.classes c on c.id = r.class_id
    where r.status in ('pending', 'failed') and r.attempts < 3 and c.status = 'published' and c.starts_at > p_now
      and r.scheduled_for <= p_now and r.scheduled_for >= p_now - interval '2 hours'
    order by r.scheduled_for, r.created_at
    for update of r skip locked
    limit 100
  ), claimed as (
    update public.class_reminders r set status = 'processing', attempts = r.attempts + 1, last_error = null
    from candidates c where r.id = c.id
    returning r.*
  ), class_counts as (
    select c.id, count(r.id)::integer as student_count, count(distinct s.guardian_id)::integer as guardian_count
    from public.classes c left join public.registrations r on r.class_id = c.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      left join public.students s on s.id = r.student_id group by c.id
  )
  select r.id, r.reminder_type,
    case when r.reminder_type in ('teacher_24h', 'teacher_3h') then coalesce(nullif(t.notification_email, ''), u.email::text) else u.email::text end,
    p.full_name, c.id, c.title, c.starts_at, c.ends_at, t.display_name,
    coalesce(counts.student_count, 0), coalesce(counts.guardian_count, 0), r.lead_minutes
  from claimed r
    join public.profiles p on p.id = r.recipient_profile_id
    join auth.users u on u.id = p.id
    join public.classes c on c.id = r.class_id
    join public.teachers t on t.id = c.teacher_id
    left join class_counts counts on counts.id = c.id
  where case when r.reminder_type in ('teacher_24h', 'teacher_3h') then coalesce(nullif(t.notification_email, ''), u.email::text) else u.email::text end is not null;
end;
$$;

revoke all on function public.claim_due_class_reminders(timestamptz) from public;
grant execute on function public.claim_due_class_reminders(timestamptz) to service_role;

-- 9. Update admin_teacher_candidates to use is_internal_user
drop function if exists public.admin_teacher_candidates();
create function public.admin_teacher_candidates()
returns table (profile_id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.full_name, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.teachers t on t.profile_id = p.id
  where public.is_internal_user() and p.active and t.id is null
  order by p.full_name;
$$;

revoke all on function public.admin_teacher_candidates() from public;
grant execute on function public.admin_teacher_candidates() to authenticated;

-- 10. Update admin_teacher_directory to use is_internal_user
drop function if exists public.admin_teacher_directory();
create function public.admin_teacher_directory()
returns table (
  active boolean,
  available_days integer[],
  available_from time,
  available_until time,
  avatar_path text,
  display_name text,
  email text,
  full_name text,
  notification_email text,
  profile_id uuid,
  teacher_id uuid
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select t.active, t.available_days, t.available_from, t.available_until, t.avatar_path, t.display_name, u.email, p.full_name, t.notification_email, p.id, t.id
  from public.teachers t
  join public.profiles p on p.id = t.profile_id
  join auth.users u on u.id = p.id
  where public.is_internal_user()
  order by p.full_name;
$$;

revoke all on function public.admin_teacher_directory() from public;
grant execute on function public.admin_teacher_directory() to authenticated;