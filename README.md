# ReChair v0.8 Live Photo Storage

## 적용 파일
- `components/ConsultationForm.tsx`
- `components/AdminConsultations.tsx`
- `app/admin/page.tsx`
- `app/api/consultations/route.ts`
- `app/api/consultations/[id]/route.ts`
- `lib/supabase.ts`
- `app/globals.css`
- `supabase/v08_photo_storage_schema.sql`

## 적용 순서
1. GitHub에 전체 덮어 업로드
2. Supabase SQL Editor에서 `supabase/v08_photo_storage_schema.sql` 실행
3. Vercel 환경변수 설정
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Vercel 재배포
5. 고객 화면에서 사진 4장 첨부 후 상담 접수
6. `/admin`에서 실제 사진 표시 확인

## 주의
Storage bucket 이름은 `consultation-photos` 입니다.
