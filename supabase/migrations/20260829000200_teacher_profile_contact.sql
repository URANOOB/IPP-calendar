-- Teacher operational profile data used by the dashboard and reminders.
alter table public.teachers
  add column notification_email text,
  add column avatar_path text;

alter table public.teachers
  add constraint teachers_notification_email_check
  check (notification_email is null or notification_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

drop function if exists public.admin_teacher_directory();
create or replace function public.admin_teacher_directory()
returns table (
  teacher_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  notification_email text,
  avatar_path text,
  display_name text,
  active boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select t.id, p.id, p.full_name,
    coalesce(nullif(t.notification_email, ''), u.email),
    t.notification_email, t.avatar_path, t.display_name, t.active
  from public.teachers t
  join public.profiles p on p.id = t.profile_id
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by t.display_name;
$$;

revoke all on function public.admin_teacher_directory() from public;
grant execute on function public.admin_teacher_directory() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-avatars', 'teacher-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "teacher avatars: admin uploads"
on storage.objects for insert to authenticated
with check (bucket_id = 'teacher-avatars' and public.is_admin() and name like 'teacher/%');

create policy "teacher avatars: admin updates"
on storage.objects for update to authenticated
using (bucket_id = 'teacher-avatars' and public.is_admin() and name like 'teacher/%')
with check (bucket_id = 'teacher-avatars' and public.is_admin() and name like 'teacher/%');

create policy "teacher avatars: admin deletes"
on storage.objects for delete to authenticated
using (bucket_id = 'teacher-avatars' and public.is_admin() and name like 'teacher/%');

create or replace function public.claim_due_class_reminders(p_now timestamptz default now())
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
  guardian_count integer
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

  with recipients as (
    select c.id as class_id, p.id as recipient_profile_id, 'teacher_24h'::public.class_reminder_type as reminder_type, c.starts_at - interval '24 hours' as scheduled_for
    from public.classes c join public.teachers t on t.id = c.teacher_id join public.profiles p on p.id = t.profile_id and p.active
    where c.status = 'published' and c.starts_at between p_now + interval '21 hours' and p_now + interval '24 hours 15 minutes'
    union all
    select c.id, p.id, 'teacher_3h'::public.class_reminder_type, c.starts_at - interval '3 hours'
    from public.classes c join public.teachers t on t.id = c.teacher_id join public.profiles p on p.id = t.profile_id and p.active
    where c.status = 'published' and c.starts_at between p_now + interval '2 hours' and p_now + interval '3 hours 15 minutes'
    union all
    select distinct c.id, p.id, 'manager_24h'::public.class_reminder_type, c.starts_at - interval '24 hours'
    from public.classes c join public.registrations r on r.class_id = c.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      join public.students s on s.id = r.student_id join public.contact_tracking ct on ct.guardian_id = s.guardian_id
      join public.profiles p on p.id = ct.assigned_to and p.role = 'contact_manager' and p.active
    where c.status = 'published' and c.starts_at between p_now + interval '21 hours' and p_now + interval '24 hours 15 minutes'
    union all
    select distinct c.id, p.id, 'manager_3h'::public.class_reminder_type, c.starts_at - interval '3 hours'
    from public.classes c join public.registrations r on r.class_id = c.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      join public.students s on s.id = r.student_id join public.contact_tracking ct on ct.guardian_id = s.guardian_id
      join public.profiles p on p.id = ct.assigned_to and p.role = 'contact_manager' and p.active
    where c.status = 'published' and c.starts_at between p_now + interval '2 hours' and p_now + interval '3 hours 15 minutes'
  )
  insert into public.class_reminders (class_id, recipient_profile_id, reminder_type, scheduled_for)
  select recipients.class_id, recipients.recipient_profile_id, recipients.reminder_type, recipients.scheduled_for
  from recipients
  on conflict on constraint class_reminders_one_recipient_per_type_key do nothing;

  return query
  with candidates as (
    select r.id
    from public.class_reminders r
    join public.classes c on c.id = r.class_id
    where r.status in ('pending', 'failed') and r.attempts < 3 and c.status = 'published' and c.starts_at > p_now
      and r.scheduled_for <= p_now
      and r.scheduled_for >= p_now - case when r.reminder_type in ('teacher_24h', 'manager_24h') then interval '2 hours' else interval '1 hour' end
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
    case when r.reminder_type in ('teacher_24h', 'teacher_3h')
      then coalesce(nullif(t.notification_email, ''), u.email::text)
      else u.email::text
    end,
    p.full_name, c.id, c.title, c.starts_at, c.ends_at, t.display_name,
    coalesce(counts.student_count, 0), coalesce(counts.guardian_count, 0)
  from claimed r
    join public.profiles p on p.id = r.recipient_profile_id
    join auth.users u on u.id = p.id
    join public.classes c on c.id = r.class_id
    join public.teachers t on t.id = c.teacher_id
    left join class_counts counts on counts.id = c.id
  where case when r.reminder_type in ('teacher_24h', 'teacher_3h')
    then coalesce(nullif(t.notification_email, ''), u.email::text)
    else u.email::text
  end is not null;
end;
$$;

revoke all on function public.claim_due_class_reminders(timestamptz) from public;
grant execute on function public.claim_due_class_reminders(timestamptz) to service_role;
