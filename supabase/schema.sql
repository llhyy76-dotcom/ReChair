create extension if not exists "pgcrypto";

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service_type text,
  model text,
  message text,
  status text default '신규',
  manager text,
  memo text,
  quote_amount numeric,
  visit_date timestamptz,
  front_photo_url text,
  side_photo_url text,
  label_photo_url text,
  back_photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into storage.buckets (id, name, public)
values ('consultation-photos', 'consultation-photos', true)
on conflict (id) do nothing;

create policy "Public read consultation photos"
on storage.objects for select
using (bucket_id = 'consultation-photos');

create policy "Allow upload consultation photos"
on storage.objects for insert
with check (bucket_id = 'consultation-photos');
