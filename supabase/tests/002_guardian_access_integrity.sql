-- Run in the Supabase SQL Editor or with psql against the local database.
-- This transaction leaves no test data behind.
begin;

do $$
declare
  v_guardian_id uuid := gen_random_uuid();
  v_token_hash text := repeat('a', 64);
begin
  insert into public.guardians (id, full_name, phone, access_token_hash)
  values (v_guardian_id, 'Acudiente de acceso', '+573001234567', v_token_hash);

  insert into public.students (guardian_id, full_name) values
    (v_guardian_id, 'Estudiante uno'),
    (v_guardian_id, 'Estudiante dos'),
    (v_guardian_id, 'Estudiante tres'),
    (v_guardian_id, 'Estudiante cuatro');

  begin
    insert into public.students (guardian_id, full_name) values (v_guardian_id, 'Estudiante quinto');
    raise exception 'Expected fifth student to fail';
  exception when raise_exception then
    if sqlerrm <> 'A guardian cannot have more than four students' then
      raise;
    end if;
  end;

  if not exists (
    select 1 from public.resolve_guardian_access_token(v_token_hash) result
    where result.guardian_name = 'Acudiente de acceso'
  ) then
    raise exception 'Expected active guardian token to resolve';
  end if;

  update public.guardians set active = false where id = v_guardian_id;

  if exists (select 1 from public.resolve_guardian_access_token(v_token_hash)) then
    raise exception 'Expected inactive guardian token to be rejected';
  end if;
end;
$$;

rollback;
