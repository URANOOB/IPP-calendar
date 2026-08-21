-- Waiting-room access, reminder delivery state, and one reusable scheduler.
create type public.class_reminder_type as enum ('teacher_24h', 'teacher_3h', 'manager_24h', 'manager_3h');
create type public.class_reminder_status as enum ('pending', 'processing', 'sent', 'failed', 'cancelled');

create table public.class_reminders (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete restrict,
  reminder_type public.class_reminder_type not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status public.class_reminder_status not null default 'pending',
  resend_email_id text,
  last_error text,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_reminders_one_recipient_per_type_key unique (class_id, recipient_profile_id, reminder_type),
  constraint class_reminders_sent_timestamp_check check (status <> 'sent' or sent_at is not null)
);

create index class_reminders_delivery_idx on public.class_reminders (status, scheduled_for);
create index class_reminders_class_id_idx on public.class_reminders (class_id);

create trigger class_reminders_set_updated_at
before update on public.class_reminders
for each row execute function public.set_updated_at();

alter table public.class_reminders enable row level security;
grant select on public.class_reminders to authenticated;

create policy "class reminders: admin manages" on public.class_reminders
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "class reminders: teacher reads own classes" on public.class_reminders
for select to authenticated using (
  exists (select 1 from public.classes c where c.id = class_reminders.class_id and c.teacher_id = public.current_teacher_id())
);
create policy "class reminders: manager reads own" on public.class_reminders
for select to authenticated using (recipient_profile_id = auth.uid() and public.is_contact_manager());

create or replace function public.get_guardian_waiting_room(token_hash text)
returns table (guardian_name text, classes jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select g.full_name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'student_name', s.full_name,
        'class_id', c.id, 'title', c.title, 'teacher_name', t.display_name,
        'starts_at', c.starts_at, 'ends_at', c.ends_at, 'status', c.status,
        'registration_status', r.status
      ) order by c.starts_at, s.full_name)
      from public.students s
      join public.registrations r on r.student_id = s.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      join public.classes c on c.id = r.class_id
      join public.teachers t on t.id = c.teacher_id
      where s.guardian_id = g.id and c.ends_at >= now() - interval '1 day'
    ), '[]'::jsonb)
  from public.guardians g
  where g.access_token_hash = token_hash and g.active;
$$;

create or replace function public.get_guardian_meeting_access(token_hash text, requested_student_id uuid, requested_class_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.meeting_url
  from public.guardians g
  join public.students s on s.guardian_id = g.id and s.id = requested_student_id and s.active
  join public.registrations r on r.student_id = s.id and r.class_id = requested_class_id and r.status in ('pending', 'confirmed')
  join public.classes c on c.id = r.class_id
  where g.access_token_hash = token_hash
    and g.active
    and c.status = 'published'
    and c.meeting_url is not null
    and now() >= c.starts_at - interval '30 minutes'
    and now() < c.ends_at;
$$;

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
  select recipients.class_id, recipients.recipient_profile_id, recipients.reminder_type, recipients.scheduled_for from recipients
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
  select r.id, r.reminder_type, u.email::text, p.full_name, c.id, c.title, c.starts_at, c.ends_at, t.display_name,
    coalesce(counts.student_count, 0), coalesce(counts.guardian_count, 0)
  from claimed r join public.profiles p on p.id = r.recipient_profile_id join auth.users u on u.id = p.id
    join public.classes c on c.id = r.class_id join public.teachers t on t.id = c.teacher_id
    left join class_counts counts on counts.id = c.id
  where u.email is not null;
end;
$$;

create or replace function public.complete_class_reminder(reminder_id uuid, resend_email_id text)
returns void language sql security definer set search_path = public as $$
  update public.class_reminders set status = 'sent', sent_at = now(), resend_email_id = complete_class_reminder.resend_email_id, last_error = null
  where id = reminder_id and status = 'processing';
$$;

create or replace function public.fail_class_reminder(reminder_id uuid, error_message text)
returns void language sql security definer set search_path = public as $$
  update public.class_reminders set status = 'failed', last_error = left(coalesce(error_message, 'Error desconocido.'), 1000)
  where id = reminder_id and status = 'processing';
$$;


create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.invoke_class_reminder_function()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'ipp_project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'ipp_reminder_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-class-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reminder-cron-secret', v_secret),
    body := jsonb_build_object('scheduled_at', now())
  );
end;
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'send-class-reminders-every-15-minutes') then
    perform cron.schedule('send-class-reminders-every-15-minutes', '*/15 * * * *', 'select public.invoke_class_reminder_function();');
  end if;
end;
$$;

revoke all on function public.get_guardian_waiting_room(text) from public;
revoke all on function public.get_guardian_meeting_access(text, uuid, uuid) from public;
revoke all on function public.claim_due_class_reminders(timestamptz) from public;
revoke all on function public.complete_class_reminder(uuid, text) from public;
revoke all on function public.fail_class_reminder(uuid, text) from public;
revoke all on function public.invoke_class_reminder_function() from public;
grant execute on function public.get_guardian_waiting_room(text) to anon, authenticated;
grant execute on function public.get_guardian_meeting_access(text, uuid, uuid) to anon, authenticated;
grant execute on function public.claim_due_class_reminders(timestamptz) to service_role;
grant execute on function public.complete_class_reminder(uuid, text) to service_role;
grant execute on function public.fail_class_reminder(uuid, text) to service_role;
