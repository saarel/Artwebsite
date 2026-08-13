-- Single-row table for site-wide settings the artist controls from the admin.
-- Today that's just which painting headlines the About page.
-- Safe to re-run.

create table if not exists site_settings (
  id int primary key default 1 check (id = 1),
  featured_mode text not null default 'latest' check (featured_mode in ('latest', 'manual')),
  featured_painting_id uuid references paintings(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed the single row.
insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;

drop policy if exists "public read site_settings" on site_settings;
drop policy if exists "auth update site_settings" on site_settings;

create policy "public read site_settings" on site_settings
  for select using (true);
create policy "auth update site_settings" on site_settings
  for update using (auth.role() = 'authenticated');
