-- Archive (soft-hide) inquiries from the admin view without losing the data.
alter table inquiries
  add column if not exists archived_at timestamptz;
