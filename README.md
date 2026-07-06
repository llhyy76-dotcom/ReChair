# ReChair v0.7 Photo Storage Update

목표: 고객이 업로드한 사진 4장(앞면/옆면/제품라벨/뒷면)을 Supabase Storage에 저장하고, 관리자 CRM에서 실제 이미지로 확인합니다.

## 교체/추가 파일
- components/ConsultationForm.tsx
- components/AdminConsultations.tsx
- app/api/consultations/route.ts
- app/api/consultations/[id]/route.ts
- supabase/v07_photo_storage_schema.sql

## 적용 순서
1. GitHub에 파일 덮어 업로드
2. Supabase SQL Editor에서 `supabase/v07_photo_storage_schema.sql` 실행
3. Vercel Environment Variables 설정
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY  ※ 서버 전용, 공개 금지
4. Vercel 재배포
5. 고객 화면에서 사진 첨부 후 `/admin` 확인

## Storage bucket
SQL에서 `consultation-photos` 버킷을 생성합니다.
