-- Operational limits, cycle-scoped guardian invitations, and staff safeguards.
create table public.guardian_cycle_invitations (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  cycle_id uuid not null references public.weekly_cycles(id) on delete restrict,
  token_hash text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index guardian_cycle_invitations_guardian_cycle_idx on public.guardian_cycle_invitations (guardian_id, cycle_id, created_at desc);
alter table public.guardian_cycle_invitations enable row level security;
grant select, insert, update on public.guardian_cycle_invitations to authenticated;
create policy "invitations: admin manages" on public.guardian_cycle_invitations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "invitations: manager assigned manages" on public.guardian_cycle_invitations for all to authenticated using (
  public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = guardian_cycle_invitations.guardian_id and ct.assigned_to = auth.uid())
) with check (public.is_contact_manager() and exists (select 1 from public.contact_tracking ct where ct.guardian_id = guardian_cycle_invitations.guardian_id and ct.assigned_to = auth.uid()));

create or replace function public.enforce_guardian_student_limit() returns trigger language plpgsql set search_path = public as $$
declare v_guardian_id uuid := new.guardian_id;
begin
  if new.active and (tg_op = 'INSERT' or not old.active or new.guardian_id is distinct from old.guardian_id) then
    perform 1 from public.guardians where id = v_guardian_id for update;
    if (select count(*) from public.students where guardian_id = v_guardian_id and active and (tg_op <> 'UPDATE' or id <> new.id)) >= 10 then
      raise exception 'A guardian cannot have more than ten active students';
    end if;
  end if;
  return new;
end; $$;

update public.classes set capacity = least(4, greatest(1, capacity)) where capacity < 1 or capacity > 4;
alter table public.classes drop constraint if exists classes_capacity_check;
alter table public.classes add constraint classes_capacity_1_to_4_check check (capacity between 1 and 4);
create or replace function public.enforce_class_capacity_not_below_enrolled() returns trigger language plpgsql set search_path = public as $$
begin
  if new.capacity < old.capacity and new.capacity < (select count(*) from public.registrations r where r.class_id = new.id and public.registration_consumes_capacity(r.status)) then
    raise exception 'Class capacity cannot be lower than its active registrations' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger classes_keep_capacity_above_enrolled before update of capacity on public.classes for each row execute function public.enforce_class_capacity_not_below_enrolled();
create or replace function public.enforce_active_teacher_for_new_class() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.teachers where id = new.teacher_id and active) then raise exception 'A class must reference an active teacher'; end if;
  return new;
end; $$;
create trigger classes_require_active_teacher before insert or update of teacher_id on public.classes for each row execute function public.enforce_active_teacher_for_new_class();

create or replace function public.create_guardian_cycle_invitation(p_guardian_id uuid, p_cycle_id uuid, p_token_hash text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or (public.is_contact_manager() and exists (select 1 from public.contact_tracking where guardian_id = p_guardian_id and assigned_to = auth.uid()))) then raise exception 'No tienes permisos para generar invitaciones.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.guardians where id = p_guardian_id and active) then raise exception 'El acudiente no está activo.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.students where guardian_id = p_guardian_id and active) then raise exception 'El acudiente debe tener al menos un estudiante activo.' using errcode = 'P0001'; end if;
  insert into public.guardian_cycle_invitations (guardian_id, cycle_id, token_hash, created_by) values (p_guardian_id, p_cycle_id, p_token_hash, auth.uid());
  update public.contact_tracking set invitation_sent_at = now() where guardian_id = p_guardian_id;
  insert into public.contact_events (guardian_id, actor_profile_id, event_type, metadata) values (p_guardian_id, auth.uid(), 'invitation_sent', jsonb_build_object('cycle_id', p_cycle_id));
end; $$;

create or replace function public.get_guardian_registration_context(token_hash text)
returns table (guardian_name text, cycle_id uuid, cycle_name text, cycle_status public.weekly_cycle_status, registration_open boolean, students jsonb, classes jsonb)
language sql stable security definer set search_path = public as $$
  select g.full_name, wc.id, wc.name, wc.status,
    (wc.status = 'open' and now() between wc.registration_opens_at and wc.registration_closes_at),
    coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'full_name',s.full_name,'registration',case when r.id is null then null else jsonb_build_object('class_id',c.id,'title',c.title,'teacher_name',t.display_name,'starts_at',c.starts_at,'ends_at',c.ends_at,'status',r.status) end) order by s.created_at) from public.students s left join public.registrations r on r.student_id=s.id and r.cycle_id=wc.id left join public.classes c on c.id=r.class_id left join public.teachers t on t.id=c.teacher_id where s.guardian_id=g.id and s.active), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'teacher_name',t.display_name,'starts_at',c.starts_at,'ends_at',c.ends_at,'capacity',c.capacity,'registered',coalesce(u.count,0),'available',greatest(c.capacity-coalesce(u.count,0),0)) order by c.starts_at,c.ends_at) from public.classes c join public.teachers t on t.id=c.teacher_id left join lateral (select count(*)::integer count from public.registrations r where r.class_id=c.id and public.registration_consumes_capacity(r.status)) u on true where c.cycle_id=wc.id and c.status='published'), '[]'::jsonb)
  from public.guardian_cycle_invitations i join public.guardians g on g.id=i.guardian_id and g.active join public.weekly_cycles wc on wc.id=i.cycle_id
  where i.token_hash=token_hash and i.active and (i.expires_at is null or i.expires_at > now());
$$;

create or replace function public.book_guardian_classes(token_hash text, selections jsonb) returns void language plpgsql security definer set search_path = public as $$
declare g_id uuid; v_cycle_id uuid; v_cycle public.weekly_cycles%rowtype; requested integer; valid integer; row_class record;
begin
  if jsonb_typeof(selections) <> 'array' or jsonb_array_length(selections)=0 or jsonb_array_length(selections)>10 then raise exception 'Selecciona al menos una clase para continuar.' using errcode='P0001'; end if;
  select i.guardian_id, i.cycle_id into g_id, v_cycle_id from public.guardian_cycle_invitations i join public.guardians g on g.id=i.guardian_id and g.active where i.token_hash=book_guardian_classes.token_hash and i.active and (i.expires_at is null or i.expires_at>now()) for update of i;
  if g_id is null then raise exception 'Este enlace no es válido o ya no está disponible.' using errcode='P0001'; end if;
  select * into v_cycle from public.weekly_cycles where id = v_cycle_id for update;
  if v_cycle.status <> 'open' or now() not between v_cycle.registration_opens_at and v_cycle.registration_closes_at then raise exception 'Las inscripciones de esta semana ya finalizaron.' using errcode='P0001'; end if;
  with q as (select (x->>'student_id')::uuid student_id,(x->>'class_id')::uuid class_id from jsonb_array_elements(selections) x) select count(*),count(distinct student_id) into requested,valid from q;
  if requested<>valid then raise exception 'Cada niño solo puede tener una clase esta semana.' using errcode='P0001'; end if;
  if (select count(*) from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections)x)q join public.students s on s.id=q.student_id and s.guardian_id=g_id and s.active) <> requested then raise exception 'No pudimos completar la inscripción. Revisa las clases seleccionadas.' using errcode='P0001'; end if;
  for row_class in select c.id from public.classes c where c.id in (select (x->>'class_id')::uuid from jsonb_array_elements(selections)x) order by c.id for update loop perform row_class.id; end loop;
  if (select count(*) from (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections)x)q join public.classes c on c.id=q.class_id and c.cycle_id=v_cycle.id and c.status='published') <> requested then raise exception 'La clase seleccionada ya no está disponible.' using errcode='P0001'; end if;
  if exists (select 1 from (select (x->>'student_id')::uuid student_id from jsonb_array_elements(selections)x)q join public.registrations r on r.student_id=q.student_id and r.cycle_id=v_cycle.id) then raise exception 'Uno de tus niños ya tiene una clase programada esta semana.' using errcode='P0001'; end if;
  if exists (with q as (select (x->>'class_id')::uuid class_id from jsonb_array_elements(selections)x), n as (select class_id,count(*) count from q group by class_id) select 1 from n join public.classes c on c.id=n.class_id where n.count + (select count(*) from public.registrations r where r.class_id=c.id and public.registration_consumes_capacity(r.status)) > c.capacity) then raise exception 'Esta clase acaba de llenarse.' using errcode='P0001'; end if;
  insert into public.registrations(student_id,class_id,cycle_id,status,confirmed_at) select (x->>'student_id')::uuid,(x->>'class_id')::uuid,v_cycle.id,'confirmed',now() from jsonb_array_elements(selections)x;
  update public.contact_tracking set response_status='booked', booked_at=coalesce(booked_at,now()) where guardian_id=g_id;
end; $$;

create or replace function public.get_guardian_waiting_room(token_hash text) returns table (guardian_name text, classes jsonb) language sql stable security definer set search_path=public as $$
 select g.full_name,coalesce((select jsonb_agg(jsonb_build_object('student_id',s.id,'student_name',s.full_name,'class_id',c.id,'title',c.title,'teacher_name',t.display_name,'starts_at',c.starts_at,'ends_at',c.ends_at,'status',c.status,'registration_status',r.status) order by c.starts_at,s.full_name) from public.students s join public.registrations r on r.student_id=s.id and r.status in ('pending','confirmed','attended','absent') join public.classes c on c.id=r.class_id join public.teachers t on t.id=c.teacher_id where s.guardian_id=g.id and c.cycle_id=i.cycle_id and c.ends_at>=now()-interval '1 day'),'[]'::jsonb) from public.guardian_cycle_invitations i join public.guardians g on g.id=i.guardian_id where i.token_hash=token_hash and i.active and (i.expires_at is null or i.expires_at>now());
$$;
create or replace function public.get_guardian_meeting_access(token_hash text, requested_student_id uuid, requested_class_id uuid) returns text language sql stable security definer set search_path=public as $$
 select c.meeting_url from public.guardian_cycle_invitations i join public.guardians g on g.id=i.guardian_id and g.active join public.students s on s.guardian_id=g.id and s.id=requested_student_id join public.registrations r on r.student_id=s.id and r.class_id=requested_class_id and r.cycle_id=i.cycle_id and r.status in ('pending','confirmed') join public.classes c on c.id=r.class_id where i.token_hash=token_hash and i.active and (i.expires_at is null or i.expires_at>now()) and c.status='published' and c.meeting_url is not null and now()>=c.starts_at-interval '30 minutes' and now()<c.ends_at;
$$;
drop function if exists public.resolve_guardian_access_token(text);
alter table public.guardians drop column if exists access_token_hash;
revoke all on function public.create_guardian_cycle_invitation(uuid,uuid,text) from public;
grant execute on function public.create_guardian_cycle_invitation(uuid,uuid,text) to authenticated;
