create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service_type text not null,
  model text,
  message text,
  status text default 'new',
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  model text,
  grade text,
  price numeric,
  status text default 'selling',
  created_at timestamptz default now()
);
