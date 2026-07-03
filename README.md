# ReChair MVP

ReChair 실제 서비스 MVP 초기 프로젝트입니다.

## 포함 기능
- 고객 홈페이지
- 상담/예약 신청 UI
- 관리자 대시보드 초안
- Supabase 연동 구조
- 상담 DB 스키마

## 로컬 실행
```bash
npm install
npm run dev
```

## Vercel 배포
1. GitHub 저장소에 전체 파일 업로드
2. Vercel에서 Import Project
3. Environment Variables에 아래 값 등록
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Deploy

## Supabase
`supabase/schema.sql` 내용을 Supabase SQL Editor에서 실행하세요.
