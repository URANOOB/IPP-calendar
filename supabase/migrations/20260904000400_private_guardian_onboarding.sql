begin;

-- A staff-created contact needs only a phone. Its private token also grants
-- access to onboarding, where the guardian's name and students are required.
do $$
declare definition text; name_guard text;
begin
  definition := pg_get_functiondef('public.ensure_staff_guardian_access(uuid,uuid)'::regprocedure);
  name_guard := E'  if coalesce(char_length(btrim(v_guardian.full_name)), 0) < 2 then\n    raise exception ''Guarda el nombre del acudiente antes de generar su enlace.'' using errcode = ''P0001'';\n  end if;';
  if position(name_guard in definition) = 0 then raise exception 'Expected staff access name guard not found'; end if;
  execute replace(definition, name_guard, '');
end;
$$;

create or replace function public.complete_private_guardian_profile(
  p_token_hash text,
  p_full_name text,
  p_student_names jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian_id uuid;
  v_cycle_id uuid;
  v_name text;
  v_current_count integer;
  v_new_count integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001';
  end if;
  if coalesce(char_length(btrim(p_full_name)), 0) < 2 or char_length(btrim(p_full_name)) > 120 then
    raise exception 'Ingresa tu nombre completo.' using errcode = 'P0001';
  end if;
  if p_student_names is null or jsonb_typeof(p_student_names) <> 'array' then
    raise exception 'Revisa los nombres de los estudiantes.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_student_names) > 10 then
    raise exception 'Puedes registrar máximo 10 estudiantes activos.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_student_names) n where jsonb_typeof(n) <> 'string')
    or exists (select 1 from jsonb_array_elements_text(p_student_names) n where char_length(btrim(n)) < 2 or char_length(btrim(n)) > 120) then
    raise exception 'Revisa los nombres de los estudiantes.' using errcode = 'P0001';
  end if;
  if (select count(*) from jsonb_array_elements_text(p_student_names)) <>
    (select count(distinct lower(btrim(n))) from jsonb_array_elements_text(p_student_names) n) then
    raise exception 'Cada estudiante debe aparecer una sola vez.' using errcode = 'P0001';
  end if;

  select i.guardian_id, i.cycle_id into v_guardian_id, v_cycle_id
  from public.guardian_cycle_invitations i join public.guardians g on g.id = i.guardian_id and g.active
  where i.token_hash = p_token_hash and i.active and (i.expires_at is null or i.expires_at > now());
  if v_guardian_id is null then
    raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001';
  end if;

  -- Serialize with public activation/staff access, and check again after locking.
  perform 1 from public.weekly_cycles where id = v_cycle_id and status = 'open' and registration_closes_at > now() for update;
  if not found then raise exception 'El registro de este ciclo ya no está disponible.' using errcode = 'P0001'; end if;
  perform 1 from public.guardians where id = v_guardian_id and active for update;
  if not found then raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001'; end if;
  perform 1 from public.guardian_cycle_invitations where token_hash = p_token_hash and guardian_id = v_guardian_id
    and active and (expires_at is null or expires_at > now()) for update;
  if not found then raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001'; end if;

  select count(*) into v_current_count from public.students where guardian_id = v_guardian_id and active;
  select count(*) into v_new_count from jsonb_array_elements_text(p_student_names) n
    where not exists (select 1 from public.students s where s.guardian_id = v_guardian_id and lower(btrim(s.full_name)) = lower(btrim(n)) and s.active);
  if v_current_count + v_new_count > 10 then
    raise exception 'Puedes registrar máximo 10 estudiantes activos.' using errcode = 'P0001';
  end if;
  if v_current_count + v_new_count = 0 then
    raise exception 'Agrega al menos un estudiante para continuar.' using errcode = 'P0001';
  end if;

  update public.guardians set full_name = btrim(p_full_name) where id = v_guardian_id;
  for v_name in select btrim(n) from jsonb_array_elements_text(p_student_names) n loop
    if not exists (select 1 from public.students where guardian_id = v_guardian_id and lower(btrim(full_name)) = lower(v_name) and active) then
      insert into public.students(guardian_id, full_name) values (v_guardian_id, v_name);
    end if;
  end loop;
  if not exists (select 1 from public.contact_events where guardian_id = v_guardian_id
    and event_type = 'registered_from_form' and metadata->>'source' = 'private_registration') then
    insert into public.contact_events(guardian_id, event_type, metadata)
      values (v_guardian_id, 'registered_from_form', jsonb_build_object('source', 'private_registration', 'cycle_id', v_cycle_id));
  end if;
end;
$$;

revoke all on function public.complete_private_guardian_profile(text,text,jsonb) from public;
grant execute on function public.complete_private_guardian_profile(text,text,jsonb) to anon, authenticated;

-- Require a completed name even when bypassing the public UI to call booking.
do $$
declare definition text; token_guard text;
begin
  definition := pg_get_functiondef('public.book_guardian_classes(text,jsonb,text)'::regprocedure);
  token_guard := 'if g_id is null then raise exception ''Este enlace no es válido o ya no está disponible.'' using errcode = ''P0001''; end if;';
  if position(token_guard in definition) = 0 then raise exception 'Expected booking token guard not found'; end if;
  execute replace(definition, token_guard, token_guard || E'\n  if not exists (select 1 from public.guardians where id = g_id and char_length(btrim(full_name)) between 2 and 120) then\n    raise exception ''Completa tu nombre antes de elegir las clases.'' using errcode = ''P0001'';\n  end if;');
end;
$$;

commit;
