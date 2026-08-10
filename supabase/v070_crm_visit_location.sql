-- ReChair OMS v0.7.0 / Sprint 8
-- CRM 방문 위치 저장 필드
alter table public.consultations add column if not exists region text;
alter table public.consultations add column if not exists address text;
create index if not exists consultations_region_idx on public.consultations(region);
