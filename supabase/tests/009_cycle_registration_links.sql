begin;

select plan(1);

do $$
declare
  v_cycle uuid := gen_random_uuid();
  v_guardian uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_access_token text := repeat('a', 43);
  v_access_hash text := encode(extensions.digest(repeat('a', 43), 'sha256'), 'hex');
  v_returned_token text;
  v_new_access_token text := repeat('c', 43);
begin
  update public.weekly_cycles set status = 'closed' where status = 'open';
  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status)
  values (v_cycle, 'Ciclo con enlace general', now() - interval '1 day', now() + interval '2 days', now() - interval '1 hour', now() + interval '1 day', 'open');
  if not (select registration_open from public.get_general_registration_welcome()) then
    raise exception 'The general registration link must be available during the cycle window';
  end if;

  insert into public.guardians (id, phone) values (v_guardian, '+573109999999');
  insert into public.students (id, guardian_id, full_name) values (v_student, v_guardian, 'Estudiante de prueba');

  select access_token into v_returned_token
  from public.activate_guardian_cycle_access('+573109999999', '  Laura Acudiente  ', jsonb_build_array('Estudiante de prueba'), v_access_token, v_access_hash);
  if v_returned_token <> v_access_token then
    raise exception 'The activated private token must be returned';
  end if;
  if (select full_name from public.guardians where id = v_guardian) <> 'Laura Acudiente' then
    raise exception 'Activation must save the submitted guardian name';
  end if;
  if (select count(*) from public.guardian_cycle_invitations where guardian_id = v_guardian and cycle_id = v_cycle and active and access_token = v_access_token) <> 1 then
    raise exception 'Activation must create exactly one active private link';
  end if;

  select access_token into v_returned_token
  from public.activate_guardian_cycle_access('+573109999999', 'Laura Actualizada', jsonb_build_array('Estudiante de prueba'), repeat('b', 43), encode(extensions.digest(repeat('b', 43), 'sha256'), 'hex'));
  if v_returned_token <> v_access_token then
    raise exception 'A second welcome submission must recover the existing private link';
  end if;
  if (select full_name from public.guardians where id = v_guardian) <> 'Laura Acudiente' then
    raise exception 'A repeat public submission must not edit guardian information';
  end if;
  if not exists (select 1 from public.get_guardian_registration_context(v_access_hash)) then
    raise exception 'The activated private token must open the existing class portal';
  end if;

  select access_token into v_returned_token
  from public.activate_guardian_cycle_access('+573108888888', 'Acudiente Nuevo', jsonb_build_array('Niña Uno', 'Niño Dos'), v_new_access_token, encode(extensions.digest(v_new_access_token, 'sha256'), 'hex'));
  if v_returned_token <> v_new_access_token then
    raise exception 'A new guardian must receive a private link after self-registration';
  end if;
  if (select count(*) from public.students s join public.guardians g on g.id = s.guardian_id where g.phone = '+573108888888' and s.active) <> 2 then
    raise exception 'Self-registration must create all submitted students';
  end if;
end;
$$;

select pass('The permanent general link activates, stores, and reuses a guardian private link.');
select * from finish();

rollback;
