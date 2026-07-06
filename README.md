# ReChair v1.0 Stable

Next.js 15 호환 안정화 버전입니다.

## 적용
1. GitHub 전체 덮어 업로드
2. Supabase SQL Editor에서 `supabase/master_schema.sql` 실행
3. Vercel 환경변수 설정
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. 재배포

## 테스트
- `/` 고객 상담 사진 업로드
- `/admin` 실제 상담/사진 확인
- `/products` 상품 목록
