create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service text,
  model text,
  message text,
  status text default '신규',
  assignee text,
  memo text,
  quote_amount text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.consultation_photos (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete cascade,
  field text not null,
  file_name text,
  public_url text not null,
  created_at timestamptz default now()
);

create table if not exists public.consultation_events (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete cascade,
  event_type text not null,
  memo text,
  created_at timestamptz default now()
);

alter table public.consultations enable row level security;
alter table public.consultation_photos enable row level security;
alter table public.consultation_events enable row level security;

drop policy if exists "public read consultations" on public.consultations;
create policy "public read consultations" on public.consultations for select to anon using (true);

drop policy if exists "public insert consultations" on public.consultations;
create policy "public insert consultations" on public.consultations for insert to anon with check (true);

drop policy if exists "public update consultations" on public.consultations;
create policy "public update consultations" on public.consultations for update to anon using (true) with check (true);

drop policy if exists "public read consultation photos" on public.consultation_photos;
create policy "public read consultation photos" on public.consultation_photos for select to anon using (true);

drop policy if exists "public insert consultation photos" on public.consultation_photos;
create policy "public insert consultation photos" on public.consultation_photos for insert to anon with check (true);

drop policy if exists "public read consultation events" on public.consultation_events;
create policy "public read consultation events" on public.consultation_events for select to anon using (true);

drop policy if exists "public insert consultation events" on public.consultation_events;
create policy "public insert consultation events" on public.consultation_events for insert to anon with check (true);

insert into storage.buckets (id, name, public)
values ('consultation-photos', 'consultation-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public upload consultation photos" on storage.objects;
create policy "public upload consultation photos"
on storage.objects for insert to anon
with check (bucket_id = 'consultation-photos');

drop policy if exists "public read consultation photos storage" on storage.objects;
create policy "public read consultation photos storage"
on storage.objects for select to anon
using (bucket_id = 'consultation-photos');
