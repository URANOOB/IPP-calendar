-- Administrators need SELECT visibility for class inserts that return the new row,
-- and to manage the complete class list.
create policy "classes: admin reads" on public.classes
for select to authenticated using (public.is_admin());
