alter table public.weekly_cycles
  add constraint weekly_cycles_active_or_inactive_check
  check (status in ('open', 'closed'));
