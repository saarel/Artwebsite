-- Inquiries from gallery visitors about specific paintings.
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  painting_id uuid not null references paintings(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  message text not null,
  created_at timestamptz default now()
);

alter table inquiries enable row level security;

-- Anyone can submit an inquiry...
create policy "public insert" on inquiries
  for insert with check (true);

-- ...but only authenticated users (the artist, once logged in) can read them.
create policy "owner read" on inquiries
  for select using (auth.role() = 'authenticated');
