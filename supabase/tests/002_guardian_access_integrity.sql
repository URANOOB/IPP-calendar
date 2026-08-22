-- Run in the Supabase SQL Editor or with psql against the local database.
-- This transaction leaves no test data behind.
begin;

do $$
declare
  v_guardian_id uuid := gen_random_uuid();
  v_token_hash text := repeat('a', 64);
begin
  insert into public.guardians (id, full_name, phone)
  values (v_guardian_id, 'Acudiente de acceso', '+573001234567');

  insert into public.students (guardian_id, full_name) values
    (v_guardian_id, 'Estudiante uno'),
    (v_guardian_id, 'Estudiante dos'),
    (v_guardian_id, 'Estudiante tres'),
    (v_guardian_id, 'Estudiante cuatro'),
    (v_guardian_id, 'Estudiante cinco'),
    (v_guardian_id, 'Estudiante seis'),
    (v_guardian_id, 'Estudiante siete'),
    (v_guardian_id, 'Estudiante ocho'),
    (v_guardian_id, 'Estudiante nueve'),
    (v_guardian_id, 'Estudiante diez');

  begin
    insert into public.students (guardian_id, full_name) values (v_guardian_id, 'Estudiante once');
    raise exception 'Expected eleventh active student to fail';
  exception when raise_exception then
    if sqlerrm <> 'A guardian cannot have more than ten active students' then
      raise;
    end if;
  end;

  update public.students set active = false where guardian_id = v_guardian_id and full_name = 'Estudiante diez';
  insert into public.students (guardian_id, full_name) values (v_guardian_id, 'Estudiante once');
end;
$$;

rollback;
