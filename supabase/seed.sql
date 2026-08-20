-- Fictitious data for local development or the Supabase SQL Editor.
-- This script never writes to auth.users. Create staff users through Supabase Auth first,
-- then create their profiles and teacher records with your normal administration flow.
-- Classes are inserted only when there is at least one active teacher.

insert into public.guardians (id, full_name, phone) values
  ('30000000-0000-0000-0000-000000000001', 'Laura García', '+573001111111'),
  ('30000000-0000-0000-0000-000000000002', 'Diego Martínez', '+573002222222')
on conflict (id) do nothing;

insert into public.students (id, guardian_id, full_name) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Valentina García'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Mateo García'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Sofía Martínez')
on conflict (id) do nothing;

insert into public.weekly_cycles (id, name, starts_at, ends_at, registration_opens_at, registration_closes_at, status) values
  ('50000000-0000-0000-0000-000000000001', 'Ciclo de ejemplo 1', '2026-09-07 05:00:00+00', '2026-09-14 05:00:00+00', '2026-08-31 05:00:00+00', '2026-09-06 23:59:59+00', 'open')
on conflict (id) do nothing;

-- Uses an existing teacher rather than creating an Auth user or profile outside its proper flow.
with first_active_teacher as (
  select id from public.teachers where active order by created_at limit 1
)
insert into public.classes (id, cycle_id, teacher_id, title, starts_at, ends_at, capacity, status)
select class_data.id, '50000000-0000-0000-0000-000000000001', teacher.id,
  class_data.title, class_data.starts_at, class_data.ends_at, class_data.capacity, 'published'
from first_active_teacher teacher
cross join (
  values
    ('60000000-0000-0000-0000-000000000001'::uuid, 'English Explorers'::text, '2026-09-08 21:00:00+00'::timestamptz, '2026-09-08 22:00:00+00'::timestamptz, 10),
    ('60000000-0000-0000-0000-000000000002'::uuid, 'Story Time'::text, '2026-09-10 21:00:00+00'::timestamptz, '2026-09-10 22:00:00+00'::timestamptz, 8),
    ('60000000-0000-0000-0000-000000000003'::uuid, 'English Games'::text, '2026-09-12 15:00:00+00'::timestamptz, '2026-09-12 16:00:00+00'::timestamptz, 12)
) as class_data(id, title, starts_at, ends_at, capacity)
on conflict (id) do nothing;

insert into public.contact_tracking (guardian_id, response_status, notes) values
  ('30000000-0000-0000-0000-000000000001', 'contacted', 'Dato ficticio para desarrollo local.'),
  ('30000000-0000-0000-0000-000000000002', 'not_contacted', 'Dato ficticio para desarrollo local.')
on conflict (guardian_id) do nothing;
