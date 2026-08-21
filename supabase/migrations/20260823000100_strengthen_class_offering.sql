create extension if not exists btree_gist with schema extensions;

create function public.enforce_class_within_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  select starts_at, ends_at into v_starts_at, v_ends_at
  from public.weekly_cycles where id = new.cycle_id;

  if v_starts_at is null or new.starts_at < v_starts_at or new.ends_at > v_ends_at then
    raise exception 'A class must occur within its weekly cycle';
  end if;
  return new;
end;
$$;

create trigger classes_require_cycle_time_range
before insert or update of cycle_id, starts_at, ends_at on public.classes
for each row execute function public.enforce_class_within_cycle();

alter table public.classes
  add constraint classes_teacher_schedule_no_overlap
  exclude using gist (
    teacher_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('draft', 'published'));

create index if not exists classes_status_idx on public.classes (status);

drop policy if exists "classes: admin manages" on public.classes;
drop policy if exists "classes: contact manager reads" on public.classes;

create policy "classes: admin inserts" on public.classes
for insert to authenticated with check (public.is_admin());
create policy "classes: admin updates" on public.classes
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "classes: teacher inserts own" on public.classes
for insert to authenticated with check (teacher_id = public.current_teacher_id());
create policy "classes: contact manager reads published" on public.classes
for select to authenticated using (public.is_contact_manager() and status = 'published');

create or replace function public.admin_teacher_directory()
returns table (
  teacher_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  display_name text,
  active boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select t.id, p.id, p.full_name, u.email, t.display_name, t.active
  from public.teachers t
  join public.profiles p on p.id = t.profile_id
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by t.display_name;
$$;

create or replace function public.admin_teacher_candidates()
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
  where public.is_admin() and p.role = 'teacher' and p.active and t.id is null
  order by p.full_name;
$$;

revoke all on function public.admin_teacher_directory() from public;
revoke all on function public.admin_teacher_candidates() from public;
grant execute on function public.admin_teacher_directory() to authenticated;
grant execute on function public.admin_teacher_candidates() to authenticated;
