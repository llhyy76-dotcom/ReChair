# ReChair Commit 1

ReChair 실제 서비스 MVP 초기 프로젝트입니다.

## 포함 기능
- Next.js App Router
- Tailwind CSS
- Supabase 연결
- 고객 랜딩페이지
- 상품 목록
- 상담/예약 신청
- 관리자 접수 대시보드

## 실행
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase
1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. `.env.local`에 아래 값 입력
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Vercel 배포
GitHub 저장소에 업로드 후 Vercel에서 Import Project를 선택하세요.
Environment Variables에 `.env.local`과 같은 값을 입력합니다.
