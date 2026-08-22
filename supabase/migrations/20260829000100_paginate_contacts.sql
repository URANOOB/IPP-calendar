-- Return only the contact rows needed by the current page.
-- The function is SECURITY INVOKER (the default), so existing RLS policies
-- continue to determine which contacts and students the caller can see.
create or replace function public.list_contact_guardians(
  p_search text default null,
  p_active boolean default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  phone text,
  active boolean,
  student_count bigint,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with filtered as (
    select
      g.id,
      g.full_name,
      g.phone,
      g.active,
      count(s.id)::bigint as student_count,
      count(*) over ()::bigint as total_count
    from public.guardians g
    left join public.students s on s.guardian_id = g.id
    where (p_active is null or g.active = p_active)
      and (
        nullif(btrim(p_search), '') is null
        or g.full_name ilike '%' || btrim(p_search) || '%'
        or (
          nullif(regexp_replace(p_search, '\D', '', 'g'), '') is not null
          and regexp_replace(g.phone, '\D', '', 'g') like '%' || regexp_replace(p_search, '\D', '', 'g') || '%'
        )
      )
    group by g.id, g.full_name, g.phone, g.active
  )
  select id, full_name, phone, active, student_count, total_count
  from filtered
  order by full_name, id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_contact_guardians(text, boolean, integer, integer) from public;
grant execute on function public.list_contact_guardians(text, boolean, integer, integer) to authenticated;

create index if not exists guardians_lower_full_name_idx
  on public.guardians (lower(full_name));
