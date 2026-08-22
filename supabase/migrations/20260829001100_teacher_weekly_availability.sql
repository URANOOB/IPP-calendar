-- Administrative weekly availability for teachers, expressed in Bogotá local time.
alter table public.teachers
  add column available_days smallint[] not null default '{}'::smallint[],
  add column available_from time,
  add column available_until time,
  add constraint teachers_availability_days_check check (available_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  add constraint teachers_availability_range_check check (
    (cardinality(available_days) = 0 and available_from is null and available_until is null)
    or (
      cardinality(available_days) > 0
      and available_from is not null
      and available_until is not null
      and available_from < available_until
    )
  );

drop function if exists public.admin_teacher_directory();
create function public.admin_teacher_directory()
returns table (
  teacher_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  notification_email text,
  avatar_path text,
  display_name text,
  active boolean,
  available_days smallint[],
  available_from time,
  available_until time
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select t.id, p.id, p.full_name,
    coalesce(nullif(t.notification_email, ''), u.email),
    t.notification_email, t.avatar_path, t.display_name, t.active,
    t.available_days, t.available_from, t.available_until
  from public.teachers t
  join public.profiles p on p.id = t.profile_id
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by t.display_name;
$$;

revoke all on function public.admin_teacher_directory() from public;
grant execute on function public.admin_teacher_directory() to authenticated;
