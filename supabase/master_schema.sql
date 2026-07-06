create extension if not exists pgcrypto;

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  phone text,
  service_type text,
  model text,
  message text,
  status text default '신규',
  assignee text,
  memo text,
  quote_amount numeric default 0,
  front_photo text,
  side_photo text,
  label_photo text,
  back_photo text,
  extra_photo text
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null,
  brand text,
  model text,
  price numeric default 0,
  status text default '판매중',
  grade text default 'A',
  description text,
  image_url text,
  source_consultation_id uuid references public.consultations(id) on delete set null
);

create table if not exists public.product_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  product_id uuid references public.products(id) on delete cascade,
  photo_url text,
  sort_order int default 0
);

alter table public.consultations enable row level security;
alter table public.products enable row level security;
alter table public.product_photos enable row level security;

drop policy if exists "public read consultations" on public.consultations;
create policy "public read consultations" on public.consultations for select to anon using (true);
drop policy if exists "public insert consultations" on public.consultations;
create policy "public insert consultations" on public.consultations for insert to anon with check (true);
drop policy if exists "public update consultations" on public.consultations;
create policy "public update consultations" on public.consultations for update to anon using (true) with check (true);

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select to anon using (true);
drop policy if exists "public insert products" on public.products;
create policy "public insert products" on public.products for insert to anon with check (true);
drop policy if exists "public update products" on public.products;
create policy "public update products" on public.products for update to anon using (true) with check (true);
drop policy if exists "public delete products" on public.products;
create policy "public delete products" on public.products for delete to anon using (true);

drop policy if exists "public read product photos" on public.product_photos;
create policy "public read product photos" on public.product_photos for select to anon using (true);
drop policy if exists "public insert product photos" on public.product_photos;
create policy "public insert product photos" on public.product_photos for insert to anon with check (true);

insert into storage.buckets (id, name, public)
values ('consultation-photos', 'consultation-photos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public upload consultation photos" on storage.objects;
create policy "public upload consultation photos" on storage.objects for insert to anon with check (bucket_id = 'consultation-photos');
drop policy if exists "public read consultation photos" on storage.objects;
create policy "public read consultation photos" on storage.objects for select to anon using (bucket_id = 'consultation-photos');
drop policy if exists "public upload product photos" on storage.objects;
create policy "public upload product photos" on storage.objects for insert to anon with check (bucket_id = 'product-photos');
drop policy if exists "public read product photos" on storage.objects;
create policy "public read product photos" on storage.objects for select to anon using (bucket_id = 'product-photos');
