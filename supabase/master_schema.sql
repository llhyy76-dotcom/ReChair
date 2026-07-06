create extension if not exists "uuid-ossp";
create table if not exists consultations (
  id uuid primary key default uuid_generate_v4(),
  name text,
  phone text,
  service text,
  model text,
  message text,
  status text default '신규',
  manager text,
  memo text,
  quote numeric,
  photo_front text,
  photo_side text,
  photo_label text,
  photo_back text,
  created_at timestamptz default now()
);
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  title text,
  brand text,
  model text,
  grade text,
  region text,
  price numeric,
  description text,
  status text default '판매중',
  image_url text,
  created_at timestamptz default now()
);
insert into storage.buckets (id, name, public) values ('consultation-photos','consultation-photos',true) on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('product-photos','product-photos',true) on conflict (id) do update set public = true;
drop policy if exists "public upload consultation photos" on storage.objects;
create policy "public upload consultation photos" on storage.objects for insert to anon with check (bucket_id = 'consultation-photos');
drop policy if exists "public read consultation photos" on storage.objects;
create policy "public read consultation photos" on storage.objects for select to anon using (bucket_id = 'consultation-photos');
drop policy if exists "public upload product photos" on storage.objects;
create policy "public upload product photos" on storage.objects for insert to anon with check (bucket_id = 'product-photos');
drop policy if exists "public read product photos" on storage.objects;
create policy "public read product photos" on storage.objects for select to anon using (bucket_id = 'product-photos');
alter table consultations enable row level security;
alter table products enable row level security;
drop policy if exists "public insert consultations" on consultations;
create policy "public insert consultations" on consultations for insert to anon with check (true);
drop policy if exists "public read consultations" on consultations;
create policy "public read consultations" on consultations for select to anon using (true);
drop policy if exists "public update consultations" on consultations;
create policy "public update consultations" on consultations for update to anon using (true) with check (true);
drop policy if exists "public read products" on products;
create policy "public read products" on products for select to anon using (true);
drop policy if exists "public insert products" on products;
create policy "public insert products" on products for insert to anon with check (true);
drop policy if exists "public update products" on products;
create policy "public update products" on products for update to anon using (true) with check (true);
drop policy if exists "public delete products" on products;
create policy "public delete products" on products for delete to anon using (true);
