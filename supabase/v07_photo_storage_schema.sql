-- ReChair v0.7 consultation photo storage schema
create extension if not exists pgcrypto;

create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service_type text not null,
  model text,
  message text,
  status text not null default '신규',
  manager text,
  memo text,
  quote_amount numeric,
  photo_front text,
  photo_side text,
  photo_label text,
  photo_back text,
  extra_photos jsonb default '[]'::jsonb,
  timeline jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table consultations enable row level security;

drop policy if exists "public insert consultations" on consultations;
create policy "public insert consultations"
on consultations for insert
to anon
with check (true);

drop policy if exists "public read consultations temporary" on consultations;
create policy "public read consultations temporary"
on consultations for select
to anon
using (true);

drop policy if exists "public update consultations temporary" on consultations;
create policy "public update consultations temporary"
on consultations for update
to anon
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('consultation-photos', 'consultation-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public upload consultation photos" on storage.objects;
create policy "public upload consultation photos"
on storage.objects for insert
to anon
with check (bucket_id = 'consultation-photos');

drop policy if exists "public read consultation photos" on storage.objects;
create policy "public read consultation photos"
on storage.objects for select
to anon
using (bucket_id = 'consultation-photos');
