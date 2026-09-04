begin;

-- Missing/inactive profiles must return FALSE. NULL would bypass PL/pgSQL
-- guards written as IF NOT is_admin()/is_internal_user() in definer RPCs.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_user_role() = 'admin', false); $$;
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_user_role() = 'manager', false); $$;
create or replace function public.is_internal_user()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_user_role() in ('admin', 'manager'), false); $$;
revoke all on function public.is_admin(), public.is_manager(), public.is_internal_user() from public, anon;
grant execute on function public.is_admin(), public.is_manager(), public.is_internal_user() to authenticated;

-- Legacy contact RPCs and the auto-assignment trigger still use this helper.
create or replace function public.is_contact_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.is_manager(), false); $$;
revoke all on function public.is_contact_manager() from public, anon;
grant execute on function public.is_contact_manager() to authenticated;

-- This pure predicate is called by invoker triggers on classes/registrations.
grant execute on function public.registration_consumes_capacity(public.registration_status) to authenticated;

-- Validate the referenced profile without exposing other staff profiles through RLS.
alter function public.enforce_teacher_profile_role() security definer;
revoke all on function public.enforce_teacher_profile_role() from public, anon, authenticated;

-- Replacing an avatar is part of editing a teacher, including for managers.
create policy "staff reads teacher avatars" on storage.objects for select to authenticated
using (bucket_id = 'teacher-avatars' and public.is_internal_user() and name like 'teacher/%');
create policy "manager uploads teacher avatars" on storage.objects for insert to authenticated
with check (bucket_id = 'teacher-avatars' and public.is_manager() and name like 'teacher/%');
create policy "manager deletes replaced teacher avatars" on storage.objects for delete to authenticated
using (bucket_id = 'teacher-avatars' and public.is_manager() and name like 'teacher/%');

-- Preserve the installed return types (local and linked schemas differ), changing
-- only the role predicate in these read-only staff directory functions.
do $$
declare signature regprocedure; definition text;
begin
  foreach signature in array array['public.admin_teacher_directory()'::regprocedure, 'public.admin_teacher_candidates()'::regprocedure] loop
    definition := pg_get_functiondef(signature);
    execute replace(definition, 'public.is_admin()', 'public.is_internal_user()');
  end loop;
end;
$$;

commit;
