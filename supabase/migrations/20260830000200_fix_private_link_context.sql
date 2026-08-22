-- Qualify function arguments explicitly. Unqualified token_hash previously
-- resolved to the table column in these SQL functions, making a private link
-- return another guardian's context when more than one invitation existed.
create or replace function public.get_guardian_registration_context(token_hash text)
returns table (
  guardian_name text,
  cycle_id uuid,
  cycle_name text,
  cycle_status public.weekly_cycle_status,
  registration_open boolean,
  students jsonb,
  classes jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select g.full_name, wc.id, wc.name, wc.status,
    (wc.status = 'open' and now() between wc.registration_opens_at and wc.registration_closes_at),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'full_name', s.full_name,
        'registration', case when r.id is null then null else jsonb_build_object('class_id', c.id, 'title', c.title, 'teacher_name', t.display_name, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'status', r.status) end
      ) order by s.created_at)
      from public.students s
      left join public.registrations r on r.student_id = s.id and r.cycle_id = wc.id
      left join public.classes c on c.id = r.class_id
      left join public.teachers t on t.id = c.teacher_id
      where s.guardian_id = g.id and s.active
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'teacher_name', t.display_name, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'capacity', c.capacity, 'registered', coalesce(u.count, 0), 'available', greatest(c.capacity - coalesce(u.count, 0), 0)) order by c.starts_at, c.ends_at)
      from public.classes c
      join public.teachers t on t.id = c.teacher_id
      left join lateral (select count(*)::integer count from public.registrations r where r.class_id = c.id and public.registration_consumes_capacity(r.status)) u on true
      where c.cycle_id = wc.id and c.status = 'published'
    ), '[]'::jsonb)
  from public.guardian_cycle_invitations i
  join public.guardians g on g.id = i.guardian_id and g.active
  join public.weekly_cycles wc on wc.id = i.cycle_id
  where i.token_hash = $1 and i.active and (i.expires_at is null or i.expires_at > now());
$$;

create or replace function public.get_guardian_waiting_room(token_hash text)
returns table (guardian_name text, classes jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select g.full_name,
    coalesce((
      select jsonb_agg(jsonb_build_object('student_id', s.id, 'student_name', s.full_name, 'class_id', c.id, 'title', c.title, 'teacher_name', t.display_name, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'status', c.status, 'registration_status', r.status) order by c.starts_at, s.full_name)
      from public.students s
      join public.registrations r on r.student_id = s.id and r.status in ('pending', 'confirmed', 'attended', 'absent')
      join public.classes c on c.id = r.class_id
      join public.teachers t on t.id = c.teacher_id
      where s.guardian_id = g.id and c.cycle_id = i.cycle_id and c.ends_at >= now() - interval '1 day'
    ), '[]'::jsonb)
  from public.guardian_cycle_invitations i
  join public.guardians g on g.id = i.guardian_id
  where i.token_hash = $1 and i.active and (i.expires_at is null or i.expires_at > now());
$$;

create or replace function public.get_guardian_meeting_access(token_hash text, requested_student_id uuid, requested_class_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.meeting_url
  from public.guardian_cycle_invitations i
  join public.guardians g on g.id = i.guardian_id and g.active
  join public.students s on s.guardian_id = g.id and s.id = $2 and s.active
  join public.registrations r on r.student_id = s.id and r.class_id = $3 and r.cycle_id = i.cycle_id and r.status in ('pending', 'confirmed')
  join public.classes c on c.id = r.class_id
  where i.token_hash = $1
    and i.active
    and (i.expires_at is null or i.expires_at > now())
    and c.status = 'published'
    and c.meeting_url is not null
    and now() >= c.starts_at - interval '30 minutes'
    and now() < c.ends_at;
$$;
