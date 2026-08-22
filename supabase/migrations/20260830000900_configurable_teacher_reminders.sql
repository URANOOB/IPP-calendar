-- Two configurable reminder slots for teachers. Their internal types stay stable
-- so sent reminder history and Resend idempotency keys remain intact.
alter table public.class_reminders
  add column if not exists lead_minutes integer not null default 0
  check (lead_minutes >= 0);

create table if not exists public.class_reminder_settings (
  singleton boolean primary key default true check (singleton),
  first_enabled boolean not null default true,
  first_lead_minutes integer not null default 1440 check (first_lead_minutes in (15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440)),
  second_enabled boolean not null default true,
  second_lead_minutes integer not null default 180 check (second_lead_minutes in (15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440)),
  updated_at timestamptz not null default now(),
  constraint class_reminder_settings_distinct_active_slots check (not (first_enabled and second_enabled and first_lead_minutes = second_lead_minutes))
);

insert into public.class_reminder_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create trigger class_reminder_settings_set_updated_at
before update on public.class_reminder_settings
for each row execute function public.set_updated_at();

alter table public.class_reminder_settings enable row level security;

create policy "class reminder settings: admin reads"
on public.class_reminder_settings for select to authenticated
using (public.is_admin());

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
  if not public.is_admin() then
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

  -- Pending reminders use the previous timing, so rebuild only future unsent
  -- teacher reminders after a configuration change.
  delete from public.class_reminders r
  using public.classes c
  where c.id = r.class_id
    and c.starts_at > now()
    and r.reminder_type in ('teacher_24h', 'teacher_3h')
    and r.status in ('pending', 'failed');
end;
$$;

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
      join public.profiles p on p.id = ct.assigned_to and p.role = 'contact_manager' and p.active
    where c.status = 'published' and c.starts_at between p_now + interval '21 hours' and p_now + interval '24 hours 15 minutes'
    union all
    select distinct c.id, p.id, 'manager_3h'::public.class_reminder_type, c.starts_at - interval '3 hours', 180
    from public.classes c join public.registrations r on r.class_id = c.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      join public.students s on s.id = r.student_id join public.contact_tracking ct on ct.guardian_id = s.guardian_id
      join public.profiles p on p.id = ct.assigned_to and p.role = 'contact_manager' and p.active
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

revoke all on function public.update_class_reminder_settings(boolean, integer, boolean, integer) from public;
grant execute on function public.update_class_reminder_settings(boolean, integer, boolean, integer) to authenticated;
revoke all on function public.claim_due_class_reminders(timestamptz) from public;
grant execute on function public.claim_due_class_reminders(timestamptz) to service_role;
