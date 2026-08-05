create table if not exists public.technician_live_locations (
  technician_id uuid primary key references public.technicians(id) on delete cascade,
  technician_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  heading double precision,
  speed_mps double precision,
  battery_percent integer,
  sharing_enabled boolean not null default true,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technician_live_locations_updated_at_idx
  on public.technician_live_locations(updated_at desc);

alter table public.technician_live_locations enable row level security;

comment on table public.technician_live_locations is
  '기사 본인이 명시적으로 위치 공유를 시작한 동안의 최신 위치. 서버 전용 API로만 접근한다.';
