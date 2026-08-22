-- A class becomes final one minute after its scheduled end, even when nobody
-- is looking at the dashboard.
create or replace function public.complete_due_classes(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed integer;
begin
  update public.classes
  set status = 'completed'
  where status = 'published'
    and ends_at <= p_now - interval '1 minute';
  get diagnostics v_completed = row_count;
  return v_completed;
end;
$$;

-- New or edited classes cannot be cancelled. Historical cancelled rows remain
-- readable, but no new cancellation can be recorded.
alter table public.classes
  add constraint classes_cannot_be_cancelled
  check (status <> 'cancelled') not valid;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'complete-finished-classes-every-minute') then
    perform cron.schedule('complete-finished-classes-every-minute', '* * * * *', 'select public.complete_due_classes();');
  end if;
end;
$$;

revoke all on function public.complete_due_classes(timestamptz) from public;
grant execute on function public.complete_due_classes(timestamptz) to service_role;
