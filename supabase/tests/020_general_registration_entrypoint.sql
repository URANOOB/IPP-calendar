-- Supersedes the former staff/private onboarding tests. Every fixture and
-- registration-window adjustment is rolled back; no notifications are sent.
begin;
do $$
declare
  v_manager uuid;
  v_cycle public.weekly_cycles%rowtype;
  v_guardian uuid;
  v_new_guardian uuid;
  v_phone text;
  v_new_phone text;
  v_token text;
  v_candidate text;
  v_hash text;
  v_returned text;
  v_teacher uuid;
  v_class_one uuid;
  v_class_two uuid;
  v_selections jsonb;
  v_blocked boolean;
begin
  if has_function_privilege('authenticated', 'public.ensure_staff_guardian_access(uuid,uuid)', 'execute')
    or has_function_privilege('anon', 'public.complete_private_guardian_profile(text,text,jsonb)', 'execute') then
    raise exception 'Initial registration must use the general form only';
  end if;
  select id into v_manager from public.profiles where role = 'manager' and active limit 1;
  select * into v_cycle from public.weekly_cycles where status = 'open' and registration_closes_at > now()
    order by registration_opens_at, starts_at, id limit 1;
  if v_manager is null or v_cycle.id is null then raise exception 'Requires staff and an eligible cycle'; end if;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  execute 'set local role authenticated';
  v_phone := '+573' || lpad(floor(random()*1000000000)::text,9,'0');
  v_guardian := public.create_pending_guardian(v_phone);
  if exists (select 1 from public.guardian_cycle_invitations where guardian_id = v_guardian) then
    raise exception 'Phone-only creation must not generate a private link';
  end if;
  execute 'reset role';
  -- Simulate an old private token generated before this workflow correction.
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.guardian_cycle_invitations(guardian_id,cycle_id,access_token,token_hash,activated_at)
    values(v_guardian,v_cycle.id,v_token,v_hash,now());
  execute 'set local role anon';
  if exists (select 1 from public.get_guardian_registration_context(v_hash)) then
    raise exception 'Incomplete legacy access must remain dormant';
  end if;
  v_blocked := false;
  begin
    perform public.activate_guardian_cycle_access(v_phone, '', '["Child One"]', v_token, v_hash);
  exception when sqlstate 'P0001' then v_blocked := true;
  end;
  if not v_blocked then raise exception 'General registration accepted an empty name'; end if;
  execute 'reset role';
  update public.weekly_cycles set registration_opens_at = least(registration_opens_at, now()-interval '1 second') where id = v_cycle.id;
  v_candidate := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_hash := encode(extensions.digest(v_candidate, 'sha256'), 'hex');
  execute 'set local role anon';
  select access_token into v_returned from public.activate_guardian_cycle_access(v_phone, 'Registered Family', '["Child One","Child Two"]', v_candidate, v_hash);
  if v_returned <> v_token then raise exception 'Existing private token should be reused'; end if;
  perform public.activate_guardian_cycle_access(v_phone, 'Registered Family', '["Child One","Child Two"]', v_candidate, v_hash);
  execute 'reset role';
  if (select count(*) from public.guardians where phone = v_phone) <> 1
    or (select count(*) from public.students where guardian_id = v_guardian) <> 2
    or (select count(*) from public.guardian_cycle_invitations where guardian_id = v_guardian and registration_completed_at is not null) <> 1 then
    raise exception 'General registration must persist once and activate the link';
  end if;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  execute 'set local role anon';
  if not exists (select 1 from public.get_guardian_registration_context(v_hash) c where c.guardian_name = 'Registered Family' and jsonb_array_length(c.students) = 2) then
    raise exception 'Completed family cannot access their classes';
  end if;
  execute 'reset role';

  -- Second case: a brand new contact created entirely by /registro.
  v_new_phone := '+573' || lpad(floor(random()*1000000000)::text,9,'0');
  v_candidate := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_hash := encode(extensions.digest(v_candidate, 'sha256'), 'hex');
  execute 'set local role anon';
  select access_token into v_returned from public.activate_guardian_cycle_access(v_new_phone, 'New Family', '["New Child"]', v_candidate, v_hash);
  if v_returned <> v_candidate then raise exception 'New registration must return its own private link'; end if;
  execute 'reset role';
  select id into v_new_guardian from public.guardians where phone = v_new_phone;
  if not exists (select 1 from public.guardian_cycle_invitations where guardian_id = v_new_guardian and registration_completed_at is not null) then
    raise exception 'New family link must appear in the dashboard';
  end if;

  -- The completed private link still books a different class for each child.
  insert into public.teachers(profile_id,display_name,notification_email) values(v_manager,'Registration audit teacher','audit@example.invalid') returning id into v_teacher;
  insert into public.classes(cycle_id,teacher_id,title,starts_at,ends_at,capacity,meeting_url,status)
    values(v_cycle.id,v_teacher,'Audit class one',v_cycle.starts_at,v_cycle.starts_at+(v_cycle.ends_at-v_cycle.starts_at)/4,4,'https://example.invalid/one','published') returning id into v_class_one;
  insert into public.classes(cycle_id,teacher_id,title,starts_at,ends_at,capacity,meeting_url,status)
    values(v_cycle.id,v_teacher,'Audit class two',v_cycle.starts_at+(v_cycle.ends_at-v_cycle.starts_at)/2,v_cycle.ends_at,4,'https://example.invalid/two','published') returning id into v_class_two;
  select jsonb_agg(jsonb_build_object('student_id',id,'class_id',case when full_name='Child One' then v_class_one else v_class_two end))
    into v_selections from public.students where guardian_id=v_guardian;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  execute 'set local role anon';
  perform public.book_guardian_classes(v_hash,v_selections);
  if not exists (select 1 from public.get_guardian_waiting_room(v_hash) w where jsonb_array_length(w.classes)=2) then
    raise exception 'Private link must expose both upcoming classes';
  end if;
  execute 'reset role';
end;
$$;
rollback;
