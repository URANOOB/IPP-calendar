-- A cycle is historical data: its time range must be valid and never overlap another cycle.
alter table public.weekly_cycles
  add column opened_at timestamptz,
  add column closed_at timestamptz;

alter table public.weekly_cycles
  add constraint weekly_cycles_registration_closes_before_end_check
  check (registration_closes_at <= ends_at);

alter table public.weekly_cycles
  add constraint weekly_cycles_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&);

-- The partial unique index is concurrency-safe: two admins cannot open different cycles together.
create unique index weekly_cycles_only_one_open_idx
  on public.weekly_cycles (status)
  where status = 'open';
