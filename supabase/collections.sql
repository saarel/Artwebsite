-- Collections: a top-level grouping that paintings get tagged into.
-- A painting can belong to any number of collections (many-to-many).
-- Safe to re-run.

------------------------------------------------------------------
-- Collections
------------------------------------------------------------------
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  cover_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists collections_position_idx on collections (position, created_at);

------------------------------------------------------------------
-- Join table: painting <-> collection
------------------------------------------------------------------
create table if not exists painting_collections (
  painting_id uuid not null references paintings(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  primary key (painting_id, collection_id)
);

create index if not exists painting_collections_collection_idx
  on painting_collections (collection_id);

------------------------------------------------------------------
-- RLS: public can read, only signed-in admin can write
------------------------------------------------------------------
alter table collections enable row level security;
alter table painting_collections enable row level security;

drop policy if exists "public read collections" on collections;
drop policy if exists "auth insert collections" on collections;
drop policy if exists "auth update collections" on collections;
drop policy if exists "auth delete collections" on collections;

create policy "public read collections" on collections
  for select using (true);
create policy "auth insert collections" on collections
  for insert with check (auth.role() = 'authenticated');
create policy "auth update collections" on collections
  for update using (auth.role() = 'authenticated');
create policy "auth delete collections" on collections
  for delete using (auth.role() = 'authenticated');

drop policy if exists "public read painting_collections" on painting_collections;
drop policy if exists "auth insert painting_collections" on painting_collections;
drop policy if exists "auth delete painting_collections" on painting_collections;

create policy "public read painting_collections" on painting_collections
  for select using (true);
create policy "auth insert painting_collections" on painting_collections
  for insert with check (auth.role() = 'authenticated');
create policy "auth delete painting_collections" on painting_collections
  for delete using (auth.role() = 'authenticated');
