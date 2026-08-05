create table if not exists public.technician_availability (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  work_date date not null,
  availability_type text not null default '근무' check (availability_type in ('근무','휴무','교육','연차')),
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (technician_id, work_date)
);

create index if not exists technician_availability_date_idx
  on public.technician_availability(work_date);

alter table public.technician_availability enable row level security;

comment on table public.technician_availability is
  '기사별 날짜 단위 근무·휴무·교육·연차 설정. 서버의 service role key로 관리합니다.';
