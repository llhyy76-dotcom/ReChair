create extension if not exists "pgcrypto";

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  phone text,
  region text,
  service_type text,
  brand text,
  model_name text,
  message text,
  status text default '신규',
  assignee text default '',
  memo text default '',
  estimate_amount numeric,
  photo_front_url text,
  photo_side_url text,
  photo_label_url text,
  photo_back_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.consultations add column if not exists photo_front_url text;
alter table public.consultations add column if not exists photo_side_url text;
alter table public.consultations add column if not exists photo_label_url text;
alter table public.consultations add column if not exists photo_back_url text;
alter table public.consultations add column if not exists assignee text default '';
alter table public.consultations add column if not exists memo text default '';
alter table public.consultations add column if not exists estimate_amount numeric;
alter table public.consultations add column if not exists updated_at timestamptz default now();

insert into storage.buckets (id, name, public)
values ('consultation-photos', 'consultation-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public read consultation photos" on storage.objects;
create policy "public read consultation photos"
on storage.objects for select
using (bucket_id = 'consultation-photos');

drop policy if exists "public upload consultation photos" on storage.objects;
create policy "public upload consultation photos"
on storage.objects for insert
with check (bucket_id = 'consultation-photos');
