-- Mark the legacy optional name argument as intentionally ignored on
-- databases that already applied the information lock migration.
create or replace function public.book_guardian_classes(token_hash text, selections jsonb, p_guardian_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g_id uuid; v_cycle_id uuid; v_cycle public.weekly_cycles%rowtype; requested integer; valid integer; row_class record;
begin
  perform p_guardian_name;
  if jsonb_typeof(selections) <> 'array' or jsonb_array_length(selections) = 0 or jsonb_array_length(selections) > 10 then raise exception 'Selecciona al menos una clase para continuar.' using errcode = 'P0001'; end if;
  select i.guardian_id, i.cycle_id into g_id, v_cycle_id from public.guardian_cycle_invitations i join public.guardians g on g.id = i.guardian_id and g.active where i.token_hash = book_guardian_classes.token_hash and i.active and (i.expires_at is null or i.expires_at > now()) for update of i;
  if g_id is null then raise exception 'Este enlace no es válido o ya no está disponible.' using errcode = 'P0001'; end if;
  select * into v_cycle from public.weekly_cycles where id = v_cycle_id for update;
  if v_cycle.status <> 'open' or now() not between v_cycle.registration_opens_at and v_cycle.registration_closes_at then raise exception 'Las inscripciones de esta semana ya finalizaron.' using errcode = 'P0001'; end if;
  with q as (select (x->>'student_id')::uuid student_id, (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x) select count(*), count(distinct student_id) into requested, valid from q;
  if requested <> valid then raise exception 'Cada niño solo puede tener una clase esta semana.' using errcode = 'P0001'; end if;
  if (select count(*) from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections) x) q join public.students s on s.id = q.student_id and s.guardian_id = g_id and s.active) <> requested then raise exception 'No pudimos completar la inscripción. Revisa las clases seleccionadas.' using errcode = 'P0001'; end if;
  for row_class in select c.id from public.classes c where c.id in (select (x->>'class_id')::uuid from jsonb_array_elements(selections) x) order by c.id for update loop perform row_class.id; end loop;
  if (select count(*) from (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x) q join public.classes c on c.id = q.class_id and c.cycle_id = v_cycle.id and c.status = 'published') <> requested then raise exception 'La clase seleccionada ya no está disponible.' using errcode = 'P0001'; end if;
  if exists (select 1 from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections) x) q join public.registrations r on r.student_id = q.student_id and r.cycle_id = v_cycle.id) then raise exception 'Uno de tus niños ya tiene una clase programada esta semana.' using errcode = 'P0001'; end if;
  if exists (with q as (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x), n as (select class_id, count(*) count from q group by class_id) select 1 from n join public.classes c on c.id = n.class_id where n.count + (select count(*) from public.registrations r where r.class_id = c.id and public.registration_consumes_capacity(r.status)) > c.capacity) then raise exception 'Esta clase acaba de llenarse.' using errcode = 'P0001'; end if;
  insert into public.registrations(student_id, class_id, cycle_id, status, confirmed_at) select (x->>'student_id')::uuid, (x->>'class_id')::uuid, v_cycle.id, 'confirmed', now() from jsonb_array_elements(selections) x;
  update public.contact_tracking set response_status = 'booked', booked_at = coalesce(booked_at, now()) where guardian_id = g_id;
end;
$$;
