-- ADAAK granular access control. Apply only to a dedicated ADAAK Supabase project
-- Prerequisite: db-schema.sql; create the first Auth user before bootstrapping owner.
-- This migration intentionally does NOT create an owner or public credentials.
create schema if not exists adak_private;
revoke all on schema adak_private from public, anon;
grant usage on schema adak_private to authenticated, anon;

alter table public.adak_staff
  add column if not exists is_owner boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists permissions text[] not null default '{}'::text[];

create or replace function adak_private.has_access(cap text) returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.adak_staff s
   where s.user_id = (select auth.uid()) and s.is_active
     and (s.is_owner or cap = any(s.permissions))
 );
$$;
revoke all on function adak_private.has_access(text) from public,anon;
grant execute on function adak_private.has_access(text) to authenticated,anon;

create or replace function adak_private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.adak_staff s
   where s.user_id=(select auth.uid()) and s.is_active and s.is_owner
 );
$$;
revoke all on function adak_private.is_owner() from public,anon;
grant execute on function adak_private.is_owner() to authenticated;

-- Even an owner cannot create a second owner or revoke the owner's own privileges
-- through the browser API. Owner changes require trusted SQL administration.
create or replace function adak_private.staff_guard() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
 if tg_op='INSERT' and new.is_owner and current_user <> 'postgres' then
    raise exception 'Owner accounts must be bootstrapped by trusted database administration';
 end if;
 if tg_op='UPDATE' and current_user <> 'postgres' and
   (new.user_id is distinct from old.user_id or new.is_owner is distinct from old.is_owner) then
    raise exception 'Owner identity cannot be edited through the API';
 end if;
 if new.permissions <@ array[
  'listings.view','listings.create','listings.edit','listings.publish','listings.delete',
  'media.view','media.upload','media.edit','media.delete',
  'private.view','private.edit','pages.view','pages.edit','pages.publish',
  'layout.edit','theme.edit','settings.edit','users.view','users.manage'
 ]::text[] is not true then
   raise exception 'Unknown permission';
 end if;
 return new;
end $$;
drop trigger if exists adak_staff_guard on public.adak_staff;
create trigger adak_staff_guard before insert or update on public.adak_staff
for each row execute function adak_private.staff_guard();

drop policy if exists adak_staff_self on public.adak_staff;
create policy adak_staff_read on public.adak_staff for select to authenticated
using (user_id=(select auth.uid()) or (select adak_private.is_owner()));
create policy adak_staff_owner_insert on public.adak_staff for insert to authenticated
with check ((select adak_private.is_owner()) and not is_owner);
create policy adak_staff_owner_update on public.adak_staff for update to authenticated
using ((select adak_private.is_owner()) and not is_owner)
with check ((select adak_private.is_owner()) and not is_owner);
create policy adak_staff_owner_delete on public.adak_staff for delete to authenticated
using ((select adak_private.is_owner()) and not is_owner);
grant select,insert,update,delete on public.adak_staff to authenticated;

drop policy if exists adak_listing_read on public.adak_listings;
drop policy if exists adak_listing_insert on public.adak_listings;
drop policy if exists adak_listing_update on public.adak_listings;
drop policy if exists adak_listing_delete on public.adak_listings;
create policy adak_listing_read on public.adak_listings for select to anon,authenticated
using (is_published or (select adak_private.has_access('listings.view')));
create policy adak_listing_insert on public.adak_listings for insert to authenticated
with check ((select adak_private.has_access('listings.create')) and
 (not is_published or (select adak_private.has_access('listings.publish'))));
create policy adak_listing_update on public.adak_listings for update to authenticated
using ((select adak_private.has_access('listings.edit')))
with check ((select adak_private.has_access('listings.edit')));
create policy adak_listing_delete on public.adak_listings for delete to authenticated
using ((select adak_private.has_access('listings.delete')));

create or replace function adak_private.listing_publish_guard() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
 if (new.is_published is distinct from old.is_published or
 (old.is_published and to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at'))
 and not adak_private.has_access('listings.publish') then
  raise exception 'Publishing permission required';
 end if;
 return new;
end $$;
drop trigger if exists adak_listing_publish_guard on public.adak_listings;
create trigger adak_listing_publish_guard before update on public.adak_listings
for each row execute function adak_private.listing_publish_guard();

drop policy if exists adak_private_staff on public.adak_listing_private;
create policy adak_private_read on public.adak_listing_private for select to authenticated
using ((select adak_private.has_access('private.view')));
create policy adak_private_insert on public.adak_listing_private for insert to authenticated
with check ((select adak_private.has_access('private.edit')));
create policy adak_private_update on public.adak_listing_private for update to authenticated
using ((select adak_private.has_access('private.edit')))
with check ((select adak_private.has_access('private.edit')));
create policy adak_private_delete on public.adak_listing_private for delete to authenticated
using ((select adak_private.has_access('private.edit')));

drop policy if exists adak_photo_read on public.adak_listing_photos;
drop policy if exists adak_photo_insert on public.adak_listing_photos;
drop policy if exists adak_photo_update on public.adak_listing_photos;
drop policy if exists adak_photo_delete on public.adak_listing_photos;
create policy adak_photo_read on public.adak_listing_photos for select to anon,authenticated
using ((is_public and exists(select 1 from public.adak_listings l where l.id=listing_id and l.is_published))
 or (select adak_private.has_access('media.view')));
create policy adak_photo_insert on public.adak_listing_photos for insert to authenticated
with check ((select adak_private.has_access('media.upload')) and not is_public);
create policy adak_photo_update on public.adak_listing_photos for update to authenticated
using ((select adak_private.has_access('media.edit')))
with check ((select adak_private.has_access('media.edit')));
create or replace function adak_private.photo_publish_guard() returns trigger
language plpgsql security invoker set search_path = '' as $
begin
 if (new.is_public is distinct from old.is_public or old.is_public)
 and not adak_private.has_access('listings.publish') then
  raise exception 'Publishing permission required';
 end if;
 return new;
end $;
drop trigger if exists adak_photo_publish_guard on public.adak_listing_photos;
create trigger adak_photo_publish_guard before update on public.adak_listing_photos
for each row execute function adak_private.photo_publish_guard();
create policy adak_photo_delete on public.adak_listing_photos for delete to authenticated
using ((select adak_private.has_access('media.delete')));

drop policy if exists adak_media_read on storage.objects;
drop policy if exists adak_media_insert on storage.objects;
drop policy if exists adak_media_update on storage.objects;
drop policy if exists adak_media_delete on storage.objects;
create policy adak_media_read on storage.objects for select to anon,authenticated
using(bucket_id='adak-media' and (
 (select adak_private.has_access('media.view'))
 or exists(select 1 from public.adak_listing_photos p
 join public.adak_listings l on l.id=p.listing_id
 where p.storage_path=name and p.is_public and l.is_published)
));
create policy adak_media_insert on storage.objects for insert to authenticated
with check(bucket_id='adak-media' and (select adak_private.has_access('media.upload')));
create policy adak_media_update on storage.objects for update to authenticated
using(bucket_id='adak-media' and (select adak_private.has_access('media.edit')))
with check(bucket_id='adak-media' and (select adak_private.has_access('media.edit')));
create policy adak_media_delete on storage.objects for delete to authenticated
using(bucket_id='adak-media' and (select adak_private.has_access('media.delete')));

-- Structured site content. The published property is a real server-side boundary.
create table if not exists public.adak_site_blocks (
 id uuid primary key default gen_random_uuid(),
 block_key text unique not null check(block_key ~ '^[a-z][a-z0-9_-]{2,79}$'),
 page_key text not null check(page_key ~ '^[a-z][a-z0-9_-]{1,79}$'),
 title text not null default '',
 content jsonb not null default '{}'::jsonb,
 styles jsonb not null default '{}'::jsonb,
 sort_order integer not null default 100,
 is_published boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.adak_site_blocks enable row level security;
revoke all on public.adak_site_blocks from anon,authenticated;
grant select on public.adak_site_blocks to anon;
grant select,insert,update,delete on public.adak_site_blocks to authenticated;
create policy adak_block_read on public.adak_site_blocks for select to anon,authenticated
using(is_published or (select adak_private.has_access('pages.view')));
create policy adak_block_insert on public.adak_site_blocks for insert to authenticated
with check ((select adak_private.has_access('pages.edit')) and
 (not is_published or (select adak_private.has_access('pages.publish'))) and
 (styles='{}'::jsonb or (select adak_private.has_access('layout.edit'))));
create policy adak_block_update on public.adak_site_blocks for update to authenticated
using ((select adak_private.has_access('pages.edit')))
with check ((select adak_private.has_access('pages.edit')));
create policy adak_block_delete on public.adak_site_blocks for delete to authenticated
using ((select adak_private.has_access('pages.edit')));

create or replace function adak_private.block_guard() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
 if (new.is_published is distinct from old.is_published or
 (old.is_published and (new.content is distinct from old.content or new.title is distinct from old.title or new.block_key is distinct from old.block_key)))
 and not adak_private.has_access('pages.publish') then raise exception 'Publishing permission required'; end if;
 if (new.styles is distinct from old.styles or new.sort_order is distinct from old.sort_order or new.page_key is distinct from old.page_key)
 and not adak_private.has_access('layout.edit') then raise exception 'Layout permission required'; end if;
 new.updated_at=now();
 return new;
end $$;
drop trigger if exists adak_block_guard on public.adak_site_blocks;
create trigger adak_block_guard before update on public.adak_site_blocks
for each row execute function adak_private.block_guard();

-- Owner bootstrap: after executing this migration in a dedicated project,
-- with the first user created in Supabase Authentication, run a trusted SQL command:
-- insert into public.adak_staff(user_id,display_name,is_owner,permissions)
-- select id,'مالک سامانه',true,'{}'::text[] from auth.users
-- where email='OWNER_EMAIL_REPLACE_ME' on conflict (user_id) do nothing;
-- This must NOT be issued through a client session.
-- CHECK: select user_id,display_name,is_owner from public.adak_staff;
