-- ReChair OMS v0.8.1
-- Rental installation schedule, field report and operating-stage linkage.
-- Run after v079_rental_quote_contract_crm.sql.

alter table public.service_schedules
  add column if not exists schedule_kind text not null default 'service';

-- If an older rental consultation has multiple schedules, only the latest
-- non-cancelled schedule is adopted as the installation job. Older schedules
-- remain ordinary service history so the unique active-installation rule can
-- be added without deleting any existing data.
with ranked_rental_schedules as (
  select
    id,
    row_number() over (
      partition by consultation_id
      order by (status <> '취소') desc, scheduled_at desc, id desc
    ) as row_no
  from public.service_schedules
  where consultation_id is not null
    and schedule_kind = 'service'
    and service_type like '%렌탈%'
)
update public.service_schedules as schedule
set schedule_kind = 'rental_installation'
from ranked_rental_schedules as ranked
where schedule.id = ranked.id
  and ranked.row_no = 1;

-- Makes the migration safe to rerun after an interrupted older attempt.
with duplicate_installations as (
  select
    id,
    row_number() over (
      partition by consultation_id
      order by (status <> '취소') desc, scheduled_at desc, id desc
    ) as row_no
  from public.service_schedules
  where consultation_id is not null
    and schedule_kind = 'rental_installation'
)
update public.service_schedules as schedule
set schedule_kind = 'service'
from duplicate_installations as duplicate
where schedule.id = duplicate.id
  and duplicate.row_no > 1;

alter table public.consultations
  add column if not exists rental_installation_completed_at timestamptz;

alter table public.consultations
  add column if not exists rental_operating_started_at timestamptz;

create index if not exists service_schedules_kind_scheduled_idx
  on public.service_schedules(schedule_kind, scheduled_at);

create unique index if not exists service_schedules_one_active_rental_installation_idx
  on public.service_schedules(consultation_id, schedule_kind)
  where consultation_id is not null
    and schedule_kind = 'rental_installation'
    and status <> '취소';

create index if not exists consultations_rental_operating_started_idx
  on public.consultations(rental_operating_started_at)
  where rental_operating_started_at is not null;

-- Preserve already approved installation reports when upgrading an existing DB.
update public.consultations as consultation
set rental_stage = '운영중',
    status = '운영중',
    rental_installation_completed_at = coalesce(
      consultation.rental_installation_completed_at,
      schedule.completed_at,
      schedule.field_report_updated_at
    ),
    rental_operating_started_at = coalesce(
      consultation.rental_operating_started_at,
      schedule.report_reviewed_at,
      schedule.completed_at,
      now()
    ),
    rental_stage_updated_at = coalesce(
      schedule.report_reviewed_at,
      schedule.completed_at,
      now()
    ),
    updated_at = now()
from public.service_schedules as schedule
where schedule.consultation_id = consultation.id
  and schedule.schedule_kind = 'rental_installation'
  and schedule.report_approval_status = '승인'
  and coalesce(consultation.rental_stage, '') not in ('계약종료','취소');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_schedules_schedule_kind_check'
      and conrelid = 'public.service_schedules'::regclass
  ) then
    alter table public.service_schedules
      add constraint service_schedules_schedule_kind_check
      check (schedule_kind in ('service','rental_installation','rental_retrieval'))
      not valid;
  end if;
end $$;
