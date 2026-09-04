begin;

-- The linked staff member is the registrar; one staff account can register
-- multiple teachers. Each teacher retains a separate operational ID and email.
alter table public.teachers drop constraint if exists teachers_profile_id_key;
create index if not exists teachers_profile_id_idx on public.teachers(profile_id);
alter table public.teachers alter column profile_id set default auth.uid();

-- Teacher reminders address the teacher, rather than the staff member who
-- registered them. Preserve the installed RPC signature and other settings.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.claim_due_class_reminders(timestamptz)'::regprocedure);
  execute replace(definition, 'p.full_name, c.id, c.title',
    'case when r.reminder_type in (''teacher_24h'', ''teacher_3h'') then t.display_name else p.full_name end, c.id, c.title');
end;
$$;

commit;
