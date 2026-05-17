-- Adds an image_dimensions column aligned to the images array.
-- Each entry is { "w": number, "h": number } in pixels.

alter table paintings
  add column if not exists dimensions jsonb not null default '[]'::jsonb;
