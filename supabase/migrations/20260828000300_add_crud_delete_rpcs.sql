-- Physical deletion is intentionally explicit and transactional so dependent rows cannot remain orphaned.
create or replace function public.delete_guardian(p_guardian_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and not (public.is_contact_manager() and exists (select 1 from public.contact_tracking where guardian_id = p_guardian_id and assigned_to = auth.uid())) then raise exception 'No tienes permisos para eliminar este acudiente.' using errcode = 'P0001'; end if;
  delete from public.registrations where student_id in (select id from public.students where guardian_id = p_guardian_id);
  delete from public.guardian_cycle_invitations where guardian_id = p_guardian_id;
  delete from public.contact_events where guardian_id = p_guardian_id;
  delete from public.contact_tracking where guardian_id = p_guardian_id;
  delete from public.students where guardian_id = p_guardian_id;
  delete from public.guardians where id = p_guardian_id;
  if not found then raise exception 'El acudiente no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_student(p_student_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and not (public.is_contact_manager() and exists (select 1 from public.students s join public.contact_tracking ct on ct.guardian_id=s.guardian_id where s.id=p_student_id and ct.assigned_to=auth.uid())) then raise exception 'No tienes permisos para eliminar este estudiante.' using errcode = 'P0001'; end if;
  delete from public.registrations where student_id = p_student_id;
  delete from public.students where id = p_student_id;
  if not found then raise exception 'El estudiante no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_class(p_class_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and not exists (select 1 from public.classes where id=p_class_id and teacher_id=public.current_teacher_id()) then raise exception 'No tienes permisos para eliminar esta clase.' using errcode = 'P0001'; end if;
  delete from public.class_reminders where class_id = p_class_id;
  delete from public.registrations where class_id = p_class_id;
  delete from public.classes where id = p_class_id;
  if not found then raise exception 'La clase no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_cycle(p_cycle_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No tienes permisos para eliminar ciclos.' using errcode = 'P0001'; end if;
  delete from public.guardian_cycle_invitations where cycle_id = p_cycle_id;
  delete from public.class_reminders where class_id in (select id from public.classes where cycle_id=p_cycle_id);
  delete from public.registrations where cycle_id = p_cycle_id;
  delete from public.classes where cycle_id = p_cycle_id;
  delete from public.weekly_cycles where id = p_cycle_id;
  if not found then raise exception 'El ciclo no existe.' using errcode = 'P0001'; end if;
end; $$;

create or replace function public.delete_teacher(p_teacher_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if not public.is_admin() then raise exception 'No tienes permisos para eliminar profesores.' using errcode = 'P0001'; end if;
  select profile_id into v_profile_id from public.teachers where id=p_teacher_id for update;
  if v_profile_id is null then raise exception 'El profesor no existe.' using errcode = 'P0001'; end if;
  delete from public.class_reminders where class_id in (select id from public.classes where teacher_id=p_teacher_id);
  delete from public.registrations where class_id in (select id from public.classes where teacher_id=p_teacher_id);
  delete from public.classes where teacher_id = p_teacher_id;
  delete from public.teachers where id = p_teacher_id;
  delete from auth.users where id = v_profile_id;
end; $$;

revoke all on function public.delete_guardian(uuid), public.delete_student(uuid), public.delete_class(uuid), public.delete_cycle(uuid), public.delete_teacher(uuid) from public;
grant execute on function public.delete_guardian(uuid), public.delete_student(uuid), public.delete_class(uuid), public.delete_cycle(uuid), public.delete_teacher(uuid) to authenticated;
