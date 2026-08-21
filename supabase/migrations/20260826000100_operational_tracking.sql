create type public.contact_event_type as enum ('contacted', 'invitation_sent', 'response_updated', 'booking_created', 'whatsapp_opened', 'attendance_updated', 'note_added', 'manager_assigned');

create table public.contact_events (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type public.contact_event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index contact_events_guardian_created_idx on public.contact_events (guardian_id, created_at desc);

alter table public.registrations
  add column attendance_marked_at timestamptz,
  add column attendance_marked_by uuid references public.profiles(id) on delete set null;

create index registrations_attendance_marked_by_idx on public.registrations (attendance_marked_by);

insert into public.contact_tracking (guardian_id)
select g.id from public.guardians g
where not exists (select 1 from public.contact_tracking ct where ct.guardian_id = g.id);

create or replace function public.create_guardian_tracking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.contact_tracking (guardian_id, assigned_to)
  values (new.id, case when public.is_contact_manager() then auth.uid() else null end)
  on conflict (guardian_id) do nothing;
  return new;
end;
$$;
create trigger guardians_create_tracking after insert on public.guardians
for each row execute function public.create_guardian_tracking();

create or replace function public.record_registration_booking_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_guardian_id uuid;
begin
  if tg_op = 'INSERT' and new.status in ('pending', 'confirmed') then
    select guardian_id into v_guardian_id from public.students where id = new.student_id;
    insert into public.contact_events (guardian_id, event_type, metadata)
    values (v_guardian_id, 'booking_created', jsonb_build_object('registration_id', new.id, 'class_id', new.class_id));
  end if;
  return new;
end;
$$;
create trigger registrations_record_booking_event after insert on public.registrations
for each row execute function public.record_registration_booking_event();

alter table public.contact_events enable row level security;
grant select, insert on public.contact_events to authenticated;
create policy "contact events: admin manages" on public.contact_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contact events: manager reads assigned" on public.contact_events for select to authenticated using (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = contact_events.guardian_id and ct.assigned_to = auth.uid())
);
create policy "contact events: manager writes assigned" on public.contact_events for insert to authenticated with check (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = contact_events.guardian_id and ct.assigned_to = auth.uid())
);

drop policy if exists "guardians: contact manager reads" on public.guardians;
drop policy if exists "guardians: contact manager inserts" on public.guardians;
drop policy if exists "guardians: contact manager updates" on public.guardians;
create policy "guardians: manager reads assigned" on public.guardians for select to authenticated using (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = guardians.id and ct.assigned_to = auth.uid())
);
create policy "guardians: manager creates assigned" on public.guardians for insert to authenticated with check (public.is_contact_manager());
create policy "guardians: manager updates assigned" on public.guardians for update to authenticated using (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = guardians.id and ct.assigned_to = auth.uid())
) with check (public.is_contact_manager());

drop policy if exists "students: contact manager reads" on public.students;
drop policy if exists "students: contact manager inserts" on public.students;
drop policy if exists "students: contact manager updates" on public.students;
create policy "students: manager reads assigned" on public.students for select to authenticated using (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = students.guardian_id and ct.assigned_to = auth.uid())
);
create policy "students: manager creates assigned" on public.students for insert to authenticated with check (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = students.guardian_id and ct.assigned_to = auth.uid())
);
create policy "students: manager updates assigned" on public.students for update to authenticated using (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = students.guardian_id and ct.assigned_to = auth.uid())
) with check (public.is_contact_manager());

drop policy if exists "registrations: contact manager reads" on public.registrations;
drop policy if exists "registrations: contact manager inserts" on public.registrations;
drop policy if exists "registrations: contact manager updates" on public.registrations;
create policy "registrations: manager reads assigned" on public.registrations for select to authenticated using (
  public.is_contact_manager() and exists (
    select 1 from public.students s join public.contact_tracking ct on ct.guardian_id = s.guardian_id
    where s.id = registrations.student_id and ct.assigned_to = auth.uid()
  )
);

drop policy if exists "contact tracking: contact manager reads" on public.contact_tracking;
drop policy if exists "contact tracking: contact manager inserts" on public.contact_tracking;
drop policy if exists "contact tracking: contact manager updates" on public.contact_tracking;
create policy "contact tracking: manager reads assigned" on public.contact_tracking for select to authenticated using (public.is_contact_manager() and assigned_to = auth.uid());
create policy "contact tracking: manager updates assigned" on public.contact_tracking for update to authenticated using (public.is_contact_manager() and assigned_to = auth.uid()) with check (public.is_contact_manager() and assigned_to = auth.uid());

create or replace function public.record_class_attendance(p_class_id uuid, p_entries jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_count integer; v_valid integer; v_entry record;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then raise exception 'La asistencia no pudo guardarse.' using errcode = 'P0001'; end if;
  if not public.is_admin() and not (exists (select 1 from public.classes c where c.id = p_class_id and c.teacher_id = public.current_teacher_id())) and not public.is_contact_manager() then
    raise exception 'No tienes permisos para registrar asistencia.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_entries) item where coalesce(item->>'registration_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or item->>'status' not in ('attended', 'absent')) then raise exception 'La asistencia no pudo guardarse.' using errcode = 'P0001'; end if;
  select count(*) into v_count from jsonb_array_elements(p_entries);
  select count(*) into v_valid from public.registrations r join jsonb_array_elements(p_entries) item on r.id = (item->>'registration_id')::uuid
  where r.class_id = p_class_id and r.status in ('pending', 'confirmed', 'attended', 'absent')
    and (not public.is_contact_manager() or exists (select 1 from public.students s join public.contact_tracking ct on ct.guardian_id = s.guardian_id where s.id = r.student_id and ct.assigned_to = v_user_id));
  if v_count <> v_valid then raise exception 'No tienes permisos para registrar asistencia.' using errcode = 'P0001'; end if;
  for v_entry in select (item->>'registration_id')::uuid as registration_id, item->>'status' as status from jsonb_array_elements(p_entries) item loop
    update public.registrations set status = v_entry.status::public.registration_status, attendance_marked_at = now(), attendance_marked_by = v_user_id where id = v_entry.registration_id;
    insert into public.contact_events (guardian_id, actor_profile_id, event_type, metadata)
    select s.guardian_id, v_user_id, 'attendance_updated', jsonb_build_object('registration_id', r.id, 'class_id', r.class_id, 'status', v_entry.status)
    from public.registrations r join public.students s on s.id = r.student_id where r.id = v_entry.registration_id;
  end loop;
end;
$$;
revoke all on function public.record_class_attendance(uuid, jsonb) from public;
grant execute on function public.record_class_attendance(uuid, jsonb) to authenticated;
