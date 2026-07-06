create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  model text,
  grade text default 'A',
  status text default '판매중',
  price integer default 0,
  image_url text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products enable row level security;

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (true);

drop policy if exists "products public insert" on public.products;
create policy "products public insert" on public.products for insert with check (true);

drop policy if exists "products public update" on public.products;
create policy "products public update" on public.products for update using (true);

drop policy if exists "products public delete" on public.products;
create policy "products public delete" on public.products for delete using (true);
