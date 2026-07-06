# ReChair v1.1 Consultation Photo Upload

목표: 고객 상담 사진 4장을 Supabase Storage에 저장하고 관리자 CRM에서 실제 사진을 표시합니다.

## 교체 파일
- lib/supabase.ts
- app/api/consultations/route.ts
- app/api/consultations/[id]/route.ts
- components/ConsultationForm.tsx
- components/AdminConsultations.tsx

## SQL 실행
Supabase SQL Editor에서 실행:
- supabase/v11_consult_photo_schema.sql

## 확인
1. GitHub에 파일 덮어 업로드
2. Vercel 배포 Ready 확인
3. 고객 화면에서 사진 포함 상담 신청
4. /admin 에서 고객명/전화번호/사진 확인
