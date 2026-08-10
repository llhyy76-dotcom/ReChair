-- ReChair OMS v0.7.9
-- Rental quotation and contract workflow inside the existing consultations CRM.
-- Run after v075_privacy_security_hardening.sql.

alter table public.consultations add column if not exists rental_stage text;
alter table public.consultations add column if not exists rental_monthly_fee numeric not null default 0;
alter table public.consultations add column if not exists rental_deposit_amount numeric not null default 0;
alter table public.consultations add column if not exists rental_setup_fee numeric not null default 0;
alter table public.consultations add column if not exists rental_contract_months integer not null default 0;
alter table public.consultations add column if not exists rental_contract_no text;
alter table public.consultations add column if not exists rental_payment_day integer;
alter table public.consultations add column if not exists rental_start_date date;
alter table public.consultations add column if not exists rental_end_date date;
alter table public.consultations add column if not exists rental_installation_at timestamptz;
alter table public.consultations add column if not exists rental_terms_memo text;
alter table public.consultations add column if not exists rental_quote_sent_at timestamptz;
alter table public.consultations add column if not exists rental_contract_signed_at timestamptz;
alter table public.consultations add column if not exists rental_stage_updated_at timestamptz;

update public.consultations
set rental_stage = '상담접수',
    rental_stage_updated_at = coalesce(rental_stage_updated_at, created_at, now())
where service_type like '%렌탈%'
  and rental_stage is null;

-- Existing rental inquiries inherit the terms registered on their linked product.
update public.consultations as c
set rental_monthly_fee = case when c.rental_monthly_fee = 0 then coalesce(p.monthly_fee, 0) else c.rental_monthly_fee end,
    rental_deposit_amount = case when c.rental_deposit_amount = 0 then coalesce(p.deposit_amount, 0) else c.rental_deposit_amount end,
    rental_setup_fee = case when c.rental_setup_fee = 0 then coalesce(p.setup_fee, 0) else c.rental_setup_fee end,
    rental_contract_months = case when c.rental_contract_months = 0 then coalesce(p.contract_months, 0) else c.rental_contract_months end
from public.products as p
where c.product_id = p.id
  and c.service_type like '%렌탈%'
  and p.listing_type = 'rental';

create index if not exists consultations_rental_stage_idx
  on public.consultations(rental_stage)
  where rental_stage is not null;

create index if not exists consultations_rental_installation_idx
  on public.consultations(rental_installation_at)
  where rental_installation_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'consultations_rental_stage_check'
      and conrelid = 'public.consultations'::regclass
  ) then
    alter table public.consultations
      add constraint consultations_rental_stage_check
      check (
        rental_stage is null or rental_stage in (
          '상담접수','조건확인','견적발송','계약대기','계약완료',
          '설치예약','운영중','계약종료','취소'
        )
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'consultations_rental_payment_day_check'
      and conrelid = 'public.consultations'::regclass
  ) then
    alter table public.consultations
      add constraint consultations_rental_payment_day_check
      check (rental_payment_day is null or rental_payment_day between 1 and 31)
      not valid;
  end if;
end $$;

