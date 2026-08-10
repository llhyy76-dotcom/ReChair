-- ReChair OMS v0.7.1
-- CRM / AI Dispatch / Products schema normalization + storage setup
create extension if not exists pgcrypto;

-- CONSULTATIONS: keep both legacy and canonical columns so old data/code remain usable.
alter table public.consultations add column if not exists name text;
alter table public.consultations add column if not exists customer_name text;
alter table public.consultations add column if not exists phone text;
alter table public.consultations add column if not exists address text;
alter table public.consultations add column if not exists region text;
alter table public.consultations add column if not exists service_type text;
alter table public.consultations add column if not exists brand text;
alter table public.consultations add column if not exists model text;
alter table public.consultations add column if not exists model_name text;
alter table public.consultations add column if not exists product_id uuid;
alter table public.consultations add column if not exists product_title text;
alter table public.consultations add column if not exists message text;
alter table public.consultations add column if not exists status text default '신규';
alter table public.consultations add column if not exists assignee text;
alter table public.consultations add column if not exists memo text;
alter table public.consultations add column if not exists estimate_amount numeric default 0;
alter table public.consultations add column if not exists next_action_at timestamptz;
alter table public.consultations add column if not exists photo_front_url text;
alter table public.consultations add column if not exists photo_side_url text;
alter table public.consultations add column if not exists photo_label_url text;
alter table public.consultations add column if not exists photo_back_url text;
alter table public.consultations add column if not exists front_photo_url text;
alter table public.consultations add column if not exists side_photo_url text;
alter table public.consultations add column if not exists label_photo_url text;
alter table public.consultations add column if not exists back_photo_url text;
alter table public.consultations add column if not exists created_at timestamptz default now();
alter table public.consultations add column if not exists updated_at timestamptz default now();

-- Old schema may have name NOT NULL while current API uses customer_name.
alter table public.consultations alter column name drop not null;

update public.consultations
set customer_name = coalesce(nullif(customer_name,''), name),
    name = coalesce(nullif(name,''), customer_name),
    model_name = coalesce(nullif(model_name,''), model),
    model = coalesce(nullif(model,''), model_name),
    photo_front_url = coalesce(photo_front_url, front_photo_url),
    photo_side_url = coalesce(photo_side_url, side_photo_url),
    photo_label_url = coalesce(photo_label_url, label_photo_url),
    photo_back_url = coalesce(photo_back_url, back_photo_url)
where true;

create index if not exists consultations_region_idx on public.consultations(region);
create index if not exists consultations_status_idx on public.consultations(status);
create index if not exists consultations_created_at_idx on public.consultations(created_at desc);

-- PRODUCTS: normalize old(name/model/image_url) and new(title/model_name/photo_urls) schemas.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text,
  brand text,
  model text,
  grade text default 'A급',
  status text default '판매중',
  price numeric default 0,
  image_url text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products add column if not exists name text;
alter table public.products add column if not exists title text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists model text;
alter table public.products add column if not exists model_name text;
alter table public.products add column if not exists price numeric default 0;
alter table public.products add column if not exists grade text default 'A급';
alter table public.products add column if not exists status text default '판매중';
alter table public.products add column if not exists year_text text;
alter table public.products add column if not exists region text;
alter table public.products add column if not exists warranty_text text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists thumbnail_url text;
alter table public.products add column if not exists photo_urls jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists stock_qty integer not null default 1;
alter table public.products add column if not exists is_visible boolean not null default true;
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists created_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.products alter column name drop not null;

update public.products
set title = coalesce(nullif(title,''), name, concat_ws(' ',brand,model)),
    name = coalesce(nullif(name,''), title),
    model_name = coalesce(nullif(model_name,''), model),
    model = coalesce(nullif(model,''), model_name),
    thumbnail_url = coalesce(thumbnail_url, image_url),
    image_url = coalesce(image_url, thumbnail_url),
    photo_urls = case
      when jsonb_array_length(coalesce(photo_urls,'[]'::jsonb)) > 0 then photo_urls
      when coalesce(thumbnail_url,image_url) is not null then jsonb_build_array(coalesce(thumbnail_url,image_url))
      else '[]'::jsonb
    end
where true;

create index if not exists products_visible_idx on public.products(is_visible);
create index if not exists products_featured_idx on public.products(is_featured);

-- Storage buckets used by current public consultation/product upload APIs.
insert into storage.buckets (id,name,public)
values ('consultation-photos','consultation-photos',true)
on conflict (id) do update set public=true;

insert into storage.buckets (id,name,public)
values ('product-photos','product-photos',true)
on conflict (id) do update set public=true;

-- Server uses service_role, while these read policies allow public images to render.
drop policy if exists "public read consultation photos v071" on storage.objects;
create policy "public read consultation photos v071"
on storage.objects for select
using (bucket_id='consultation-photos');

drop policy if exists "public read product photos v071" on storage.objects;
create policy "public read product photos v071"
on storage.objects for select
using (bucket_id='product-photos');
