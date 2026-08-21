-- Public access is deliberately limited to this token-resolution function.
-- It returns no IDs, phone numbers, hashes, or internal tracking information.
create or replace function public.resolve_guardian_access_token(token_hash text)
returns table (
  guardian_name text,
  students jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.full_name as guardian_name,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('full_name', s.full_name) order by s.created_at)
        from public.students s
        where s.guardian_id = g.id and s.active
      ),
      '[]'::jsonb
    ) as students
  from public.guardians g
  where g.access_token_hash = token_hash and g.active;
$$;

revoke all on function public.resolve_guardian_access_token(text) from public;
grant execute on function public.resolve_guardian_access_token(text) to anon, authenticated;
