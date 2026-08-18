-- ReChair OMS v0.8.3
-- Rental retrieval scheduling, return inspection and product-status linkage.
-- Run after v082_rental_billing_operations.sql.

alter table public.consultations
  add column if not exists rental_retrieval_at timestamptz;

alter table public.consultations
  add column if not exists rental_retrieval_completed_at timestamptz;

alter table public.consultations
  add column if not exists rental_termination_reason text;

alter table public.consultations
  add column if not exists rental_return_condition text;

alter table public.consultations
  add column if not exists rental_return_disposition text;

alter table public.service_schedules
  add column if not exists rental_return_condition text;

alter table public.service_schedules
  add column if not exists rental_return_disposition text;

create unique index if not exists service_schedules_one_active_rental_retrieval_idx
  on public.service_schedules(consultation_id, schedule_kind)
  where consultation_id is not null
    and schedule_kind = 'rental_retrieval'
    and status <> '취소';

create index if not exists consultations_rental_retrieval_idx
  on public.consultations(rental_retrieval_at)
  where rental_retrieval_at is not null;

create index if not exists consultations_rental_retrieval_completed_idx
  on public.consultations(rental_retrieval_completed_at)
  where rental_retrieval_completed_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_schedules_rental_return_condition_check'
      and conrelid = 'public.service_schedules'::regclass
  ) then
    alter table public.service_schedules
      add constraint service_schedules_rental_return_condition_check
      check (
        rental_return_condition is null or
        rental_return_condition in ('정상','경미손상','수리필요','심각손상','부품누락')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_schedules_rental_return_disposition_check'
      and conrelid = 'public.service_schedules'::regclass
  ) then
    alter table public.service_schedules
      add constraint service_schedules_rental_return_disposition_check
      check (
        rental_return_disposition is null or
        rental_return_disposition in ('재렌탈가능','점검필요','정비필요','폐기검토')
      ) not valid;
  end if;
end $$;

