-- ReChair OMS v0.8.2
-- Rental monthly billing, payment history and contract-expiry operations.
-- Run after v081_rental_installation_operations.sql.

create extension if not exists pgcrypto;

create table if not exists public.rental_payments (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  billing_month date not null,
  due_date date not null,
  amount numeric not null default 0 check (amount >= 0),
  status text not null default '납부예정'
    check (status in ('납부예정','납부완료','면제','취소')),
  paid_at timestamptz,
  payment_method text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultation_id, billing_month)
);

create index if not exists rental_payments_consultation_due_idx
  on public.rental_payments(consultation_id, due_date);

create index if not exists rental_payments_status_due_idx
  on public.rental_payments(status, due_date);

alter table public.rental_payments enable row level security;
revoke all on table public.rental_payments from anon, authenticated;

-- Normalize billing_month so it always represents the first day of a month.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_payments_billing_month_first_day_check'
      and conrelid = 'public.rental_payments'::regclass
  ) then
    alter table public.rental_payments
      add constraint rental_payments_billing_month_first_day_check
      check (billing_month = date_trunc('month', billing_month)::date)
      not valid;
  end if;
end $$;

