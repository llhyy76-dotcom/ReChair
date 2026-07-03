# ReChair Build Fix 3

Vercel 빌드 오류 `Error: supabaseUrl is required` 해결용 패치입니다.

## 업로드 방법

GitHub 저장소에 이 압축파일 내용을 기존 파일 위에 덮어 업로드하세요.

반드시 아래 파일들이 교체되어야 합니다.

- `app/api/consultations/route.ts`
- `app/api/reservations/route.ts`
- `lib/supabase.ts`

## 이유

이전 버전은 API route가 빌드 과정에서 Supabase client를 바로 생성하면서, Vercel 환경변수가 없으면 빌드가 실패했습니다.

이번 버전은 환경변수가 없어도 빌드는 통과하고, 실제 DB 저장은 환경변수 등록 후 작동합니다.

## 다음 단계

배포 성공 후 실제 접수 저장을 쓰려면 Vercel > Project Settings > Environment Variables에 아래 값을 등록하세요.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
