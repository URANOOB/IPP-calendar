-- Run in the Supabase SQL Editor or with psql against the local database.
-- Uses distant dates and rolls back all fixtures.
begin;

do $$
declare
  v_cycle_a uuid := gen_random_uuid();
  v_cycle_b uuid := gen_random_uuid();
begin
  -- The fixture must be independent from the local seed cycle; rollback restores it.
  update public.weekly_cycles set status = 'closed' where status = 'open';

  insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at)
  values
    (v_cycle_a, 'Ciclo de restricciones A', '2040-01-01 05:00:00+00', '2040-01-08 05:00:00+00', '2039-12-29 13:00:00+00', '2040-01-07 23:00:00+00'),
    (v_cycle_b, 'Ciclo de restricciones B', '2040-01-08 05:00:00+00', '2040-01-15 05:00:00+00', '2040-01-05 13:00:00+00', '2040-01-14 23:00:00+00');

  begin
    insert into public.weekly_cycles (name, starts_at, ends_at, registration_opens_at, registration_closes_at)
    values ('Ciclo con fechas inválidas', '2040-02-02 05:00:00+00', '2040-02-01 05:00:00+00', '2040-01-30 05:00:00+00', '2040-02-01 23:00:00+00');
    raise exception 'Expected invalid cycle dates to fail';
  exception when check_violation then null;
  end;

  begin
    insert into public.weekly_cycles (name, starts_at, ends_at, registration_opens_at, registration_closes_at)
    values ('Ciclo solapado', '2040-01-07 05:00:00+00', '2040-01-14 05:00:00+00', '2040-01-04 13:00:00+00', '2040-01-13 23:00:00+00');
    raise exception 'Expected overlapping cycle to fail';
  exception when exclusion_violation then null;
  end;

  update public.weekly_cycles set status = 'open', opened_at = now() where id = v_cycle_a;

  begin
    update public.weekly_cycles set status = 'open', opened_at = now() where id = v_cycle_b;
    raise exception 'Expected a second open cycle to fail';
  exception when unique_violation then null;
  end;

  update public.weekly_cycles set status = 'closed', closed_at = now() where id = v_cycle_a;
  update public.weekly_cycles set status = 'archived' where id = v_cycle_a;
end;
$$;

rollback;
