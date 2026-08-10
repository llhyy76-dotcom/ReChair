-- ReChair OMS v0.7.5
-- Customer privacy consent records and removal of anonymous access.
-- Run after v074_rental_product_management.sql.

alter table public.consultations add column if not exists privacy_consent boolean not null default false;
alter table public.consultations add column if not exists privacy_consent_at timestamptz;
alter table public.consultations add column if not exists privacy_policy_version text;
alter table public.consultations add column if not exists retention_expires_at timestamptz;

update public.consultations
set retention_expires_at = coalesce(retention_expires_at, created_at + interval '1 year')
where created_at is not null;

create index if not exists consultations_retention_expires_idx
  on public.consultations(retention_expires_at);

-- All customer records are accessed only through server-side authenticated APIs.
alter table public.consultations enable row level security;
revoke all on table public.consultations from anon, authenticated;

drop policy if exists "public read consultations temporary" on public.consultations;
drop policy if exists "public read consultations" on public.consultations;
drop policy if exists "public insert consultations" on public.consultations;
drop policy if exists "anon insert consultations" on public.consultations;
drop policy if exists "public update consultations" on public.consultations;

do $$
begin
  if to_regclass('public.reservations') is not null then
    execute 'alter table public.reservations enable row level security';
    execute 'revoke all on table public.reservations from anon, authenticated';
  end if;
end $$;

do $$
begin
  if to_regclass('public.consultation_photos') is not null then
    execute 'revoke all on table public.consultation_photos from anon, authenticated';
    execute 'drop policy if exists "public read consultation photos" on public.consultation_photos';
  end if;

  if to_regclass('public.consultation_events') is not null then
    execute 'revoke all on table public.consultation_events from anon, authenticated';
    execute 'drop policy if exists "public read consultation events" on public.consultation_events';
  end if;
end $$;

-- Consultation photos can no longer be opened with permanent public URLs.
update storage.buckets
set public = false
where id = 'consultation-photos';

drop policy if exists "public read consultation photos v071" on storage.objects;
drop policy if exists "public read consultation photos" on storage.objects;
drop policy if exists "public read consultation photos storage" on storage.objects;
drop policy if exists "public upload consultation photos" on storage.objects;
drop policy if exists "anon upload consultation photos" on storage.objects;

-- Product images remain public, but anonymous data mutation is not allowed.
revoke insert, update, delete on table public.products from anon, authenticated;
drop policy if exists "products public insert" on public.products;
drop policy if exists "products public update" on public.products;
drop policy if exists "products public delete" on public.products;
drop policy if exists "public insert products" on public.products;
drop policy if exists "public update products" on public.products;
drop policy if exists "public delete products" on public.products;
