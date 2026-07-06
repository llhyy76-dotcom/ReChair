import { createClient } from '@supabase/supabase-js';
export function getSupabase(){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url || !key) return null;
  return createClient(url,key);
}
export const photoFields = ['front_photo','side_photo','label_photo','back_photo','extra_photo'] as const;
