-- Teacher records remain available to assign classes, but they do not imply a
-- staff login role. Keep the explicit admin/manager split intact.
create or replace function public.prevent_teacher_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  return new;
end;
$$;

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
  where public.is_admin() and p.active and t.id is null
  order by p.full_name;
$$;

revoke all on function public.admin_teacher_candidates() from public;
grant execute on function public.admin_teacher_candidates() to authenticated;
