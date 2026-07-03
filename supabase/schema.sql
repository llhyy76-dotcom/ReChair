create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  phone text not null,
  service_type text not null,
  region text,
  model text,
  message text,
  status text default 'new',
  manager_note text,
  expected_revenue numeric default 0
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null,
  brand text,
  model text,
  price numeric default 0,
  status text default '판매중',
  description text,
  image_url text
);
