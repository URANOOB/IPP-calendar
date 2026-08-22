-- Global activity feed used by the dashboard notification center.
create table public.platform_activity (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  entity_id uuid,
  entity_type text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  subject text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index platform_activity_created_at_idx on public.platform_activity (created_at desc);

alter table public.platform_activity enable row level security;
grant select, delete on public.platform_activity to authenticated;

create policy "platform activity: admin reads" on public.platform_activity
for select to authenticated using (public.is_admin());

create policy "platform activity: admin deletes" on public.platform_activity
for delete to authenticated using (public.is_admin());

create or replace function public.record_platform_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_subject text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_subject := coalesce(
    nullif(v_row ->> 'name', ''),
    nullif(v_row ->> 'title', ''),
    nullif(v_row ->> 'display_name', ''),
    nullif(v_row ->> 'full_name', ''),
    nullif(v_row ->> 'phone', ''),
    case when tg_table_name = 'contact_events' then 'Actividad de seguimiento' end,
    case when tg_table_name = 'registrations' then 'Inscripción a clase' end,
    'Registro de plataforma'
  );

  insert into public.platform_activity (actor_profile_id, entity_id, entity_type, action, subject, metadata)
  values (
    auth.uid(),
    nullif(v_row ->> 'id', '')::uuid,
    tg_table_name,
    case tg_op
      when 'INSERT' then 'created'
      when 'UPDATE' then 'updated'
      when 'DELETE' then 'deleted'
    end,
    v_subject,
    jsonb_strip_nulls(jsonb_build_object(
      'status', v_row ->> 'status',
      'event_type', v_row ->> 'event_type',
      'guardian_id', v_row ->> 'guardian_id',
      'cycle_id', v_row ->> 'cycle_id',
      'class_id', v_row ->> 'class_id'
    ))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger guardians_platform_activity after insert or update or delete on public.guardians
for each row execute function public.record_platform_activity();
create trigger students_platform_activity after insert or update or delete on public.students
for each row execute function public.record_platform_activity();
create trigger teachers_platform_activity after insert or update or delete on public.teachers
for each row execute function public.record_platform_activity();
create trigger weekly_cycles_platform_activity after insert or update or delete on public.weekly_cycles
for each row execute function public.record_platform_activity();
create trigger classes_platform_activity after insert or update or delete on public.classes
for each row execute function public.record_platform_activity();
create trigger registrations_platform_activity after insert or update or delete on public.registrations
for each row execute function public.record_platform_activity();
create trigger contact_events_platform_activity after insert or update or delete on public.contact_events
for each row execute function public.record_platform_activity();
