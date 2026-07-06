# ReChair v1.0 RC1

통합 안정화 버전입니다.

## 포함 기능
- 고객 메인 홈페이지
- 상담 신청 + 사진 4장 업로드
- Supabase Storage 저장
- 관리자 상담 CRM 실데이터 조회
- 상태/담당자/메모/견적 저장
- 고객 중고상품 목록 `/products`
- 상품 상세 `/products/[id]`
- 관리자 상품관리 `/admin/products`
- 통합 DB 스키마 `supabase/master_schema.sql`

## 적용 순서
1. GitHub에 전체 덮어 업로드
2. Supabase SQL Editor에서 `supabase/master_schema.sql` 전체 실행
3. Vercel Environment Variables 입력
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_SITE_URL=https://re-chair-9hdc.vercel.app
4. Vercel 재배포
5. 고객 상담 접수 테스트
6. `/admin`에서 실제 고객정보와 사진 확인

## 주요 경로
- 고객 메인 `/`
- 중고상품 `/products`
- 관리자 CRM `/admin`
- 관리자 상품관리 `/admin/products`
