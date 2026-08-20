-- Correct the E.164 expression introduced by the initial migration.
-- A single backslash escapes the regex `+` operator in PostgreSQL.

alter table public.guardians
  drop constraint if exists guardians_phone_check;

alter table public.guardians
  add constraint guardians_phone_check
  check (phone ~ '^\+[1-9][0-9]{7,14}$');
