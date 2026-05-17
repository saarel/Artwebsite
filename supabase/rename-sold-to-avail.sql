-- Rename `sold` to `avail` and flip the meaning.
-- Before: sold=true means it's sold (unavailable). Default false (= available).
-- After:  avail=true means it's available.            Default true.

alter table paintings rename column sold to avail;
alter table paintings alter column avail drop default;
update paintings set avail = not avail;
alter table paintings alter column avail set default true;
