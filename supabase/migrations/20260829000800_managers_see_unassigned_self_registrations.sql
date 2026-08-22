-- Public self-registrations start unassigned. Contact managers must be able
-- to see and complete those new records from the Contacts module.
drop policy if exists "guardians: manager reads assigned" on public.guardians;
drop policy if exists "guardians: manager updates assigned" on public.guardians;
create policy "guardians: manager reads assigned or unassigned" on public.guardians for select to authenticated using (
  public.is_contact_manager() and exists (
    select 1 from public.contact_tracking ct
    where ct.guardian_id = guardians.id and (ct.assigned_to = auth.uid() or ct.assigned_to is null)
  )
);
create policy "guardians: manager updates assigned or unassigned" on public.guardians for update to authenticated using (
  public.is_contact_manager() and exists (
    select 1 from public.contact_tracking ct
    where ct.guardian_id = guardians.id and (ct.assigned_to = auth.uid() or ct.assigned_to is null)
  )
) with check (public.is_contact_manager());

drop policy if exists "students: manager reads assigned" on public.students;
drop policy if exists "students: manager updates assigned" on public.students;
create policy "students: manager reads assigned or unassigned" on public.students for select to authenticated using (
  public.is_contact_manager() and exists (
    select 1 from public.contact_tracking ct
    where ct.guardian_id = students.guardian_id and (ct.assigned_to = auth.uid() or ct.assigned_to is null)
  )
);
create policy "students: manager updates assigned or unassigned" on public.students for update to authenticated using (
  public.is_contact_manager() and exists (
    select 1 from public.contact_tracking ct
    where ct.guardian_id = students.guardian_id and (ct.assigned_to = auth.uid() or ct.assigned_to is null)
  )
) with check (public.is_contact_manager());

drop policy if exists "contact tracking: manager reads assigned" on public.contact_tracking;
drop policy if exists "contact tracking: manager updates assigned" on public.contact_tracking;
create policy "contact tracking: manager reads assigned or unassigned" on public.contact_tracking for select to authenticated using (
  public.is_contact_manager() and (assigned_to = auth.uid() or assigned_to is null)
);
create policy "contact tracking: manager updates assigned or unassigned" on public.contact_tracking for update to authenticated using (
  public.is_contact_manager() and (assigned_to = auth.uid() or assigned_to is null)
) with check (public.is_contact_manager() and (assigned_to = auth.uid() or assigned_to is null));
