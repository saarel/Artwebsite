-- Add a type column so we can distinguish painting inquiries from commission requests.
-- Commissions don't reference a painting, so painting_id must be nullable.

alter table inquiries
  alter column painting_id drop not null;

alter table inquiries
  add column if not exists type text not null default 'inquiry';

-- Optional: constrain to known values.
alter table inquiries
  drop constraint if exists inquiries_type_check;
alter table inquiries
  add constraint inquiries_type_check check (type in ('inquiry', 'commission'));
