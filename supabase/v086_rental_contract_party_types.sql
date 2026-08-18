-- ReChair OMS v0.8.6
-- Contracting-party types and centrally managed rental supplier information.
-- Run after supabase/v085_electronic_rental_contracts.sql.

alter table public.rental_contracts
  add column if not exists customer_entity_type text;

alter table public.rental_contracts
  drop constraint if exists rental_contracts_customer_entity_type_check;

alter table public.rental_contracts
  add constraint rental_contracts_customer_entity_type_check
  check (
    customer_entity_type is null or
    customer_entity_type in ('individual','sole_proprietor','corporation')
  );

create table if not exists public.rental_contract_provider_settings (
  id smallint primary key default 1 check (id = 1),
  entity_type text not null
    check (entity_type in ('sole_proprietor','corporation')),
  business_name text not null,
  representative text not null,
  business_number text not null,
  corporate_number text,
  address text not null,
  phone text not null,
  updated_at timestamptz not null default now()
);

alter table public.rental_contract_provider_settings enable row level security;
revoke all on table public.rental_contract_provider_settings from anon, authenticated;

-- Signed document snapshots remain immutable. New party type metadata is protected
-- together with the existing v0.8.5 evidence fields.
create or replace function public.protect_signed_rental_contract()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('signed','superseded') then
    if new.consultation_id is distinct from old.consultation_id
      or new.version is distinct from old.version
      or new.contract_no is distinct from old.contract_no
      or new.contract_type is distinct from old.contract_type
      or new.customer_entity_type is distinct from old.customer_entity_type
      or new.document_snapshot is distinct from old.document_snapshot
      or new.document_sha256 is distinct from old.document_sha256
      or new.terms_version is distinct from old.terms_version
      or new.signature_path is distinct from old.signature_path
      or new.signer_name is distinct from old.signer_name
      or new.contract_consent is distinct from old.contract_consent
      or new.privacy_consent is distinct from old.privacy_consent
      or new.signed_at is distinct from old.signed_at then
      raise exception 'SIGNED_RENTAL_CONTRACT_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_contracts_protect_signed on public.rental_contracts;
create trigger rental_contracts_protect_signed
before update on public.rental_contracts
for each row execute function public.protect_signed_rental_contract();
