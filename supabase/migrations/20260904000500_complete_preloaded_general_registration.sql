begin;
-- A staff-supplied name must not prevent onboarding an otherwise empty contact
-- through the existing general registration form. Preserve an existing name.
do $$
declare definition text; old_branch text; new_branch text;
begin
  definition := pg_get_functiondef('public.activate_guardian_cycle_access(text,text,jsonb,text,text)'::regprocedure);
  old_branch := E'  elsif v_guardian_name is null then\n    update public.guardians set full_name = btrim(p_full_name) where id = v_guardian_id;\n    perform public.add_new_guardian_students(v_guardian_id, p_student_names);\n  end if;';
  new_branch := E'  elsif v_guardian_name is null then\n    update public.guardians set full_name = btrim(p_full_name) where id = v_guardian_id;\n    perform public.add_new_guardian_students(v_guardian_id, p_student_names);\n  elsif not exists (select 1 from public.students where guardian_id = v_guardian_id and active) then\n    perform public.add_new_guardian_students(v_guardian_id, p_student_names);\n  end if;';
  definition := replace(definition, E'\r\n', E'\n');
  if position(old_branch in definition) = 0 then raise exception 'Expected general registration branch not found'; end if;
  execute replace(definition, old_branch, new_branch);
end;
$$;
commit;
