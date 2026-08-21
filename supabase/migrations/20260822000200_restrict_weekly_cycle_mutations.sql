-- Cycles are permanent historical records. Administrators may create and update them,
-- but no authenticated role receives a DELETE policy.
drop policy if exists "weekly cycles: admin manages" on public.weekly_cycles;

create policy "weekly cycles: admin inserts" on public.weekly_cycles
for insert to authenticated
with check (public.is_admin());

create policy "weekly cycles: admin updates" on public.weekly_cycles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());
