-- PostgreSQL reports trigger operations as INSERT/UPDATE/DELETE while the
-- activity table stores their user-facing past-tense counterparts.
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
