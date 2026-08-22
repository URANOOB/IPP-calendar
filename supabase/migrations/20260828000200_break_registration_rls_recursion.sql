-- Avoid a circular policy chain: students -> registrations -> students.
create or replace function public.is_assigned_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    join public.contact_tracking ct on ct.guardian_id = s.guardian_id
    where s.id = p_student_id and ct.assigned_to = auth.uid()
  );
$$;

revoke all on function public.is_assigned_student(uuid) from public;
grant execute on function public.is_assigned_student(uuid) to authenticated;

drop policy if exists "registrations: manager reads assigned" on public.registrations;
create policy "registrations: manager reads assigned" on public.registrations
for select to authenticated using (
  public.is_contact_manager() and public.is_assigned_student(student_id)
);
