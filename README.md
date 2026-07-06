# ReChair Admin CRM Photo Update

## 목적
사진 첨부 상담이 들어온 뒤 관리자가 `/admin`에서 상담 목록, 상세 정보, 첨부 사진, 상태, 담당자, 메모를 관리할 수 있게 하는 업데이트입니다.

## 교체/추가 파일
- `app/admin/page.tsx`
- `components/AdminConsultations.tsx`
- `app/api/consultations/route.ts`
- `app/api/consultations/[id]/route.ts`

## 업로드 후 확인
1. GitHub에 전체 덮어 업로드
2. Vercel 배포가 Ready 되는지 확인
3. `https://re-chair-9hdc.vercel.app/admin` 접속
4. 상담 CRM 화면이 보이면 성공

## Supabase 테이블 권장 컬럼
`consultations` 테이블에 아래 컬럼이 있으면 실제 DB 저장/조회까지 이어집니다.

```sql
create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  phone text,
  service text,
  model text,
  message text,
  photos text[] default '{}',
  status text default '신규',
  manager text,
  memo text
);
```
