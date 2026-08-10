import { getSupabaseServer } from '@/lib/supabaseServer';

const BUCKET = 'consultation-photos';
const CANONICAL_FIELDS = [
  ['photo_front_url', 'front_photo_url'],
  ['photo_side_url', 'side_photo_url'],
  ['photo_label_url', 'label_photo_url'],
  ['photo_back_url', 'back_photo_url'],
] as const;

function extractObjectPath(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '');

  const markers = [
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/sign/${BUCKET}/`,
  ];

  for (const marker of markers) {
    const index = raw.indexOf(marker);
    if (index >= 0) {
      const encoded = raw.slice(index + marker.length).split('?')[0];
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    }
  }

  return null;
}

export async function signConsultationPhotoRows<T extends Record<string, any>>(
  supabase: ReturnType<typeof getSupabaseServer>,
  rows: T[]
) {
  const paths = new Set<string>();

  for (const row of rows) {
    for (const [canonical, legacy] of CANONICAL_FIELDS) {
      const path = extractObjectPath(row[canonical] || row[legacy]);
      if (path) paths.add(path);
    }
  }

  const signed = new Map<string, string>();
  const uniquePaths = Array.from(paths);

  if (uniquePaths.length) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(uniquePaths, 15 * 60);

    if (error) {
      console.error('consultation photo sign error', error);
    } else {
      for (const item of data || []) {
        if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
      }
    }
  }

  return rows.map((row) => {
    const next: Record<string, any> = { ...row };

    for (const [canonical, legacy] of CANONICAL_FIELDS) {
      const path = extractObjectPath(row[canonical] || row[legacy]);
      next[canonical] = path ? signed.get(path) || null : null;
    }

    return next as T;
  });
}

export async function signConsultationPhotoRow<T extends Record<string, any>>(
  supabase: ReturnType<typeof getSupabaseServer>,
  row: T
) {
  const [signed] = await signConsultationPhotoRows(supabase, [row]);
  return signed;
}

