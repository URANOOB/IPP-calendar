-- Apply the access restrictions to databases that already ran the first
-- cycle-link migration.
revoke all on function public.create_guardian_cycle_invitation(uuid, uuid, text) from public;
revoke insert, update on public.guardian_cycle_invitations from authenticated;
