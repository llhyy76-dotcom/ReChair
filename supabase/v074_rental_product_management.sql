-- ReChair OMS v0.7.4
-- Rental product management fields for the existing products table.
-- Run after v071_crm_products_rental_integration.sql.

alter table public.products add column if not exists listing_type text not null default 'sale';
alter table public.products add column if not exists rental_type text;
alter table public.products add column if not exists monthly_fee numeric not null default 0;
alter table public.products add column if not exists deposit_amount numeric not null default 0;
alter table public.products add column if not exists setup_fee numeric not null default 0;
alter table public.products add column if not exists contract_months integer not null default 0;
alter table public.products add column if not exists installation_regions text;
alter table public.products add column if not exists rental_notes text;

update public.products
set listing_type = 'sale'
where listing_type is null or listing_type not in ('sale','rental');

update public.products
set rental_type = null
where listing_type = 'sale';

create index if not exists products_listing_type_idx
  on public.products(listing_type);

create index if not exists products_rental_type_idx
  on public.products(rental_type)
  where listing_type = 'rental';

