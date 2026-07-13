insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public product photos read" on storage.objects;
create policy "public product photos read"
on storage.objects for select
using (bucket_id = 'product-photos');
