-- New classes are available immediately and always provide their meeting room.
alter table public.classes
  alter column status set default 'published';

alter table public.classes
  add constraint classes_meeting_url_required
  check (meeting_url is not null and btrim(meeting_url) <> '' and meeting_url ~ '^https://') not valid;
