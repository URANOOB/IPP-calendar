-- Inglés pa' la Paz: foundational relational model, integrity rules, and staff RLS.
-- All calendar timestamps are stored as timestamptz (UTC). Presentation is application-side.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'teacher', 'contact_manager');
create type public.weekly_cycle_status as enum ('draft', 'open', 'closed', 'archived');
create type public.class_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.registration_status as enum ('pending', 'confirmed', 'cancelled', 'attended', 'absent');
create type public.contact_response_status as enum ('not_contacted', 'contacted', 'no_response', 'interested', 'declined', 'booked');
create type public.contact_attendance_status as enum ('not_recorded', 'attended', 'did_not_attend');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  full_name text not null check (char_length(btrim(full_name)) >= 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) >= 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) >= 2),
  -- Normalized E.164. The application must normalize before inserting.
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  access_token_hash text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) >= 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weekly_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) >= 2),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  status public.weekly_cycle_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_cycles_date_order_check check (starts_at < ends_at),
  constraint weekly_cycles_registration_window_check check (registration_opens_at < registration_closes_at)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.weekly_cycles(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  title text not null check (char_length(btrim(title)) >= 2),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  meeting_url text,
  status public.class_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_date_order_check check (starts_at < ends_at),
  -- Supports the registration FK that guarantees its cycle agrees with the class cycle.
  constraint classes_id_cycle_id_key unique (id, cycle_id)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null,
  cycle_id uuid not null,
  status public.registration_status not null default 'pending',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registrations_one_class_per_student_cycle_key unique (student_id, cycle_id),
  constraint registrations_class_matches_cycle_fkey
    foreign key (class_id, cycle_id) references public.classes(id, cycle_id) on delete restrict,
  constraint registrations_confirmed_timestamp_check
    check (status <> 'confirmed' or confirmed_at is not null)
);

create table public.contact_tracking (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null unique references public.guardians(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  first_contact_at timestamptz,
  invitation_sent_at timestamptz,
  response_status public.contact_response_status not null default 'not_contacted',
  booked_at timestamptz,
  attendance_status public.contact_attendance_status not null default 'not_recorded',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_guardian_id_idx on public.students (guardian_id);
create index classes_cycle_id_idx on public.classes (cycle_id);
create index classes_teacher_id_idx on public.classes (teacher_id);
create index classes_starts_at_idx on public.classes (starts_at);
-- registrations_one_class_per_student_cycle_key already indexes student_id and cycle_id.
create index registrations_class_id_idx on public.registrations (class_id);
create index registrations_cycle_id_idx on public.registrations (cycle_id);
-- contact_tracking.guardian_id is indexed by its UNIQUE constraint.
create index contact_tracking_assigned_to_idx on public.contact_tracking (assigned_to);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.enforce_teacher_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = new.profile_id and role = 'teacher' and active
  ) then
    raise exception 'A teacher must reference an active profile with the teacher role';
  end if;
  return new;
end;
$$;

create function public.prevent_teacher_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role <> 'teacher' and exists (select 1 from public.teachers where profile_id = new.id) then
    raise exception 'A profile linked to a teacher cannot be assigned a different role';
  end if;
  return new;
end;
$$;

create function public.enforce_guardian_student_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.guardian_id is distinct from old.guardian_id then
    -- Serializes concurrent inserts for one guardian, preventing a fifth student race condition.
    perform 1 from public.guardians where id = new.guardian_id for update;

    if (select count(*) from public.students where guardian_id = new.guardian_id) >= 4 then
      raise exception 'A guardian cannot have more than four students';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger profiles_keep_teacher_role
before update of role on public.profiles
for each row execute function public.prevent_teacher_profile_role_change();

create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

create trigger teachers_require_teacher_profile
before insert or update of profile_id on public.teachers
for each row execute function public.enforce_teacher_profile_role();

create trigger guardians_set_updated_at
before update on public.guardians
for each row execute function public.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger students_limit_per_guardian
before insert or update of guardian_id on public.students
for each row execute function public.enforce_guardian_student_limit();

create trigger weekly_cycles_set_updated_at
before update on public.weekly_cycles
for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger registrations_set_updated_at
before update on public.registrations
for each row execute function public.set_updated_at();

create trigger contact_tracking_set_updated_at
before update on public.contact_tracking
for each row execute function public.set_updated_at();

create function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create function public.is_contact_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'contact_manager';
$$;

create function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() is not null;
$$;

create function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.teachers where profile_id = auth.uid() and active;
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_contact_manager() from public;
revoke all on function public.is_internal_user() from public;
revoke all on function public.current_teacher_id() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_contact_manager() to authenticated;
grant execute on function public.is_internal_user() to authenticated;
grant execute on function public.current_teacher_id() to authenticated;

alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.guardians enable row level security;
alter table public.students enable row level security;
alter table public.weekly_cycles enable row level security;
alter table public.classes enable row level security;
alter table public.registrations enable row level security;
alter table public.contact_tracking enable row level security;

grant select, insert, update, delete on public.profiles, public.teachers, public.guardians,
  public.students, public.weekly_cycles, public.classes, public.registrations,
  public.contact_tracking to authenticated;

create policy "profiles: staff reads own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: admin manages" on public.profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "teachers: staff reads" on public.teachers
for select to authenticated using (public.is_internal_user());
create policy "teachers: admin manages" on public.teachers
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "guardians: admin manages" on public.guardians
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "guardians: contact manager reads" on public.guardians
for select to authenticated using (public.is_contact_manager());
create policy "guardians: contact manager inserts" on public.guardians
for insert to authenticated with check (public.is_contact_manager());
create policy "guardians: contact manager updates" on public.guardians
for update to authenticated using (public.is_contact_manager()) with check (public.is_contact_manager());
create policy "guardians: teacher reads enrolled" on public.guardians
for select to authenticated using (
  exists (
    select 1 from public.students s
    join public.registrations r on r.student_id = s.id
    join public.classes c on c.id = r.class_id
    where s.guardian_id = guardians.id and c.teacher_id = public.current_teacher_id()
  )
);

create policy "students: admin manages" on public.students
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students: contact manager reads" on public.students
for select to authenticated using (public.is_contact_manager());
create policy "students: contact manager inserts" on public.students
for insert to authenticated with check (public.is_contact_manager());
create policy "students: contact manager updates" on public.students
for update to authenticated using (public.is_contact_manager()) with check (public.is_contact_manager());
create policy "students: teacher reads enrolled" on public.students
for select to authenticated using (
  exists (
    select 1 from public.registrations r
    join public.classes c on c.id = r.class_id
    where r.student_id = students.id and c.teacher_id = public.current_teacher_id()
  )
);

create policy "weekly cycles: internal staff reads" on public.weekly_cycles
for select to authenticated using (public.is_internal_user());
create policy "weekly cycles: admin manages" on public.weekly_cycles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "classes: admin manages" on public.classes
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "classes: contact manager reads" on public.classes
for select to authenticated using (public.is_contact_manager());
create policy "classes: teacher reads own" on public.classes
for select to authenticated using (teacher_id = public.current_teacher_id());
create policy "classes: teacher updates own" on public.classes
for update to authenticated using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

create policy "registrations: admin manages" on public.registrations
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "registrations: contact manager reads" on public.registrations
for select to authenticated using (public.is_contact_manager());
create policy "registrations: contact manager inserts" on public.registrations
for insert to authenticated with check (public.is_contact_manager());
create policy "registrations: contact manager updates" on public.registrations
for update to authenticated using (public.is_contact_manager()) with check (public.is_contact_manager());
create policy "registrations: teacher reads own classes" on public.registrations
for select to authenticated using (
  exists (select 1 from public.classes c where c.id = registrations.class_id and c.teacher_id = public.current_teacher_id())
);

create policy "contact tracking: admin manages" on public.contact_tracking
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contact tracking: contact manager reads" on public.contact_tracking
for select to authenticated using (public.is_contact_manager());
create policy "contact tracking: contact manager inserts" on public.contact_tracking
for insert to authenticated with check (public.is_contact_manager());
create policy "contact tracking: contact manager updates" on public.contact_tracking
for update to authenticated using (public.is_contact_manager()) with check (public.is_contact_manager());
