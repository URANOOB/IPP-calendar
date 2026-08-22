-- Operationally, cycles use only two states: active (open) and inactive
-- (closed). The legacy enum values remain for historical compatibility.
drop index if exists public.weekly_cycles_only_one_open_idx;

update public.weekly_cycles
set status = case when status in ('draft', 'open') then 'open'::public.weekly_cycle_status else 'closed'::public.weekly_cycle_status end,
    opened_at = case when status in ('draft', 'open') then coalesce(opened_at, now()) else opened_at end,
    closed_at = case when status in ('closed', 'archived') then coalesce(closed_at, now()) else closed_at end;

alter table public.weekly_cycles
  alter column status set default 'open';

-- A class can only be created or moved into an active cycle. Existing classes
-- remain as historical records if their cycle is later deactivated.
create or replace function public.enforce_class_within_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_status public.weekly_cycle_status;
begin
  select starts_at, ends_at, status into v_starts_at, v_ends_at, v_status
  from public.weekly_cycles where id = new.cycle_id;

  if v_starts_at is null or new.starts_at < v_starts_at or new.ends_at > v_ends_at then
    raise exception 'A class must occur within its weekly cycle';
  end if;
  if v_status <> 'open' then
    raise exception 'A class can only be associated with an active cycle';
  end if;
  return new;
end;
$$;
