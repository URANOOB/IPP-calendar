begin;

-- Managers may clear the shared notification feed, just like administrators.
-- This grants no deletion rights on the underlying business records.
create policy "manager deletes activity" on public.platform_activity
for delete to authenticated using (public.is_manager());

commit;
