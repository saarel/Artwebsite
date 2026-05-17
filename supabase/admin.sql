-- Sprint 3 additions. Safe to run on top of paintings + inquiries tables.

------------------------------------------------------------------
-- Paintings: track availability
------------------------------------------------------------------
alter table paintings
  add column if not exists avail boolean not null default true;

------------------------------------------------------------------
-- Inquiries: track read/unread
------------------------------------------------------------------
alter table inquiries
  add column if not exists read_at timestamptz;

------------------------------------------------------------------
-- RLS: allow signed-in admin (any authenticated user) to manage
------------------------------------------------------------------
-- Paintings
drop policy if exists "auth insert paintings" on paintings;
drop policy if exists "auth update paintings" on paintings;
drop policy if exists "auth delete paintings" on paintings;

create policy "auth insert paintings" on paintings
  for insert with check (auth.role() = 'authenticated');
create policy "auth update paintings" on paintings
  for update using (auth.role() = 'authenticated');
create policy "auth delete paintings" on paintings
  for delete using (auth.role() = 'authenticated');

-- Inquiries (already has public insert + owner read from earlier).
-- Add update so admin can mark as read.
drop policy if exists "auth update inquiries" on inquiries;
create policy "auth update inquiries" on inquiries
  for update using (auth.role() = 'authenticated');

------------------------------------------------------------------
-- Storage bucket for painting images
------------------------------------------------------------------
-- Create bucket if it doesn't exist (public so the gallery img tags work).
insert into storage.buckets (id, name, public)
values ('paintings', 'paintings', true)
on conflict (id) do nothing;

-- Public can read; only authenticated can write/delete.
drop policy if exists "public read painting images" on storage.objects;
drop policy if exists "auth upload painting images" on storage.objects;
drop policy if exists "auth delete painting images" on storage.objects;

create policy "public read painting images" on storage.objects
  for select using (bucket_id = 'paintings');

create policy "auth upload painting images" on storage.objects
  for insert with check (bucket_id = 'paintings' and auth.role() = 'authenticated');

create policy "auth delete painting images" on storage.objects
  for delete using (bucket_id = 'paintings' and auth.role() = 'authenticated');
