# ReChair Live DB Update

## 목적
고객 상담 접수 → Supabase DB 저장 → 사진 Storage 저장 → 관리자 CRM 조회/상태변경 구조입니다.

## 교체/추가 파일
- `lib/supabaseAdmin.ts`
- `app/api/consultations/route.ts`
- `app/api/consultations/[id]/route.ts`
- `components/ConsultationForm.tsx`
- `components/AdminConsultations.tsx`
- `app/admin/page.tsx`는 `app_admin_page.tsx` 내용을 복사해서 교체하세요.
- `supabase/schema.sql`

## Vercel 환경변수
Vercel → Project → Settings → Environment Variables

필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

권장:
- `SUPABASE_SERVICE_ROLE_KEY`

주의: Service Role Key는 절대 GitHub에 올리지 마세요.

## Supabase SQL 적용
Supabase → SQL Editor → `supabase/schema.sql` 실행

## 확인 경로
- 고객: `/`
- 관리자: `/admin`
