-- ADAAK Real Estate / Supabase (PostgreSQL 15+)
-- Run in a fresh, dedicated Supabase project. Do not reuse other business databases.
-- FIRST create a Supabase Auth user via Authentication -> Users -> Invite user.
-- After running this schema, grant staff role with the instruction at the bottom.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.adak_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'مدیر آداک',
  created_at timestamptz not null default now()
);

create table if not exists public.adak_listings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  title text not null check (char_length(title) between 5 and 160),
  category text not null default 'آپارتمان' check (char_length(category) <= 40),
  district text not null default 'کرج' check (char_length(district) <= 80),
  area_m2 integer check (area_m2 > 0 and area_m2 <= 100000),
  bedrooms smallint check (bedrooms >= 0 and bedrooms <= 20),
  exposure text not null default '' check (char_length(exposure) <= 50),
  summary text not null default '' check (char_length(summary) <= 1600),
  seo_title text not null default '' check (char_length(seo_title) <= 100),
  seo_description text not null default '' check (char_length(seo_description) <= 200),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adak_listing_private (
  listing_id uuid primary key references public.adak_listings(id) on delete cascade,
  owner_name text not null default '',
  owner_phone text not null default '',
  exact_address text not null default '',
  negotiated_price text not null default '',
  internal_notes text not null default ''
);

create table if not exists public.adak_listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.adak_listings(id) on delete cascade,
  storage_path text not null unique,
  media_kind text not null default 'original' check (media_kind in ('original','simulation')),
  alt_text text not null default '' check (char_length(alt_text)<=160),
  sort_order integer not null default 100,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists adak_listings_visible on public.adak_listings (is_published,created_at desc);
create index if not exists adak_photos_listing on public.adak_listing_photos (listing_id,sort_order);

create or replace function public.adak_update_timestamp() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists adak_listings_timestamp on public.adak_listings;
create trigger adak_listings_timestamp before update on public.adak_listings
for each row execute function public.adak_update_timestamp();

alter table public.adak_staff enable row level security;
alter table public.adak_listings enable row level security;
alter table public.adak_listing_private enable row level security;
alter table public.adak_listing_photos enable row level security;

revoke all on public.adak_staff from anon;
revoke all on public.adak_listing_private from anon;
grant select on public.adak_staff to authenticated;
grant select,insert,update,delete on public.adak_listings to authenticated;
grant select on public.adak_listings to anon;
grant select,insert,update,delete on public.adak_listing_photos to authenticated;
grant select on public.adak_listing_photos to anon;
grant select,insert,update,delete on public.adak_listing_private to authenticated;

-- Staff membership is managed from SQL Editor, not by a public signup route.
drop policy if exists adak_staff_self on public.adak_staff;
create policy adak_staff_self on public.adak_staff for select to authenticated
using ((select auth.uid())=user_id);

drop policy if exists adak_listing_read on public.adak_listings;
create policy adak_listing_read on public.adak_listings for select to anon,authenticated
using (is_published or exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_listing_insert on public.adak_listings;
create policy adak_listing_insert on public.adak_listings for insert to authenticated
with check (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_listing_update on public.adak_listings;
create policy adak_listing_update on public.adak_listings for update to authenticated
using (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())))
with check (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_listing_delete on public.adak_listings;
create policy adak_listing_delete on public.adak_listings for delete to authenticated
using (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));

drop policy if exists adak_private_staff on public.adak_listing_private;
create policy adak_private_staff on public.adak_listing_private for all to authenticated
using (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())))
with check (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));

drop policy if exists adak_photo_read on public.adak_listing_photos;
create policy adak_photo_read on public.adak_listing_photos for select to anon,authenticated
using ((is_public and exists (select 1 from public.adak_listings l where l.id=listing_id and l.is_published))
       or exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_photo_insert on public.adak_listing_photos;
create policy adak_photo_insert on public.adak_listing_photos for insert to authenticated
with check (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_photo_update on public.adak_listing_photos;
create policy adak_photo_update on public.adak_listing_photos for update to authenticated
using (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())))
with check (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_photo_delete on public.adak_listing_photos;
create policy adak_photo_delete on public.adak_listing_photos for delete to authenticated
using (exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));

-- PRIVATE bucket: anonymous users cannot browse unpublished photos.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('adak-media','adak-media',false,6291456,array['image/webp'])
on conflict (id) do update set public=false,file_size_limit=6291456,allowed_mime_types=array['image/webp'];

drop policy if exists adak_media_read on storage.objects;
create policy adak_media_read on storage.objects for select to anon,authenticated
using (bucket_id='adak-media' and (
  exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid()))
  or exists (
    select 1 from public.adak_listing_photos p
    join public.adak_listings l on l.id=p.listing_id
    where p.storage_path=name and p.is_public and l.is_published
  )
));
drop policy if exists adak_media_insert on storage.objects;
create policy adak_media_insert on storage.objects for insert to authenticated
with check (bucket_id='adak-media' and exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_media_update on storage.objects;
create policy adak_media_update on storage.objects for update to authenticated
using (bucket_id='adak-media' and exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())))
with check (bucket_id='adak-media' and exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));
drop policy if exists adak_media_delete on storage.objects;
create policy adak_media_delete on storage.objects for delete to authenticated
using (bucket_id='adak-media' and exists (select 1 from public.adak_staff s where s.user_id=(select auth.uid())));

-- BOOTSTRAP A TRUSTED ADMIN, AFTER AN AUTH USER HAS BEEN CREATED:
-- insert into public.adak_staff (user_id,display_name)
-- select id,'مدیریت آداک' from auth.users where email='YOUR_ADMIN_EMAIL_HERE'
-- on conflict (user_id) do nothing;
-- Check this inserted 1 row. Never expose the email, password or secret key in frontend assets.
