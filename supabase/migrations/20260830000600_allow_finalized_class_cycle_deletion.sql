-- Finalized operational records can be purged by an administrator. This also
-- enables safe direct DELETE calls in addition to the transactional RPCs.
drop policy if exists "classes: admin deletes finalized" on public.classes;
create policy "classes: admin deletes finalized" on public.classes
for delete to authenticated
using (
  public.is_admin()
  and (status = 'completed' or ends_at <= now() - interval '1 minute')
);

drop policy if exists "weekly cycles: admin deletes finalized" on public.weekly_cycles;
create policy "weekly cycles: admin deletes finalized" on public.weekly_cycles
for delete to authenticated
using (
  public.is_admin()
  and (status = 'closed' or ends_at <= now())
);
