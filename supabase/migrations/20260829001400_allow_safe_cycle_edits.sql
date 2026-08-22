-- Administrators may correct cycle dates, but cannot leave already-associated
-- classes outside the corrected cycle range.
create or replace function public.enforce_cycle_contains_existing_classes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.classes c
    where c.cycle_id = new.id
      and (c.starts_at < new.starts_at or c.ends_at > new.ends_at)
  ) then
    raise exception 'A cycle cannot exclude existing classes';
  end if;
  return new;
end;
$$;

create trigger weekly_cycles_keep_existing_classes_in_range
before update of starts_at, ends_at on public.weekly_cycles
for each row execute function public.enforce_cycle_contains_existing_classes();
