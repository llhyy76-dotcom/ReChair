# ReChair v0.6 Product System

## 적용 파일
- app/products/page.tsx
- app/products/[id]/page.tsx
- app/api/products/route.ts
- app/api/products/[id]/route.ts
- app/admin/products/page.tsx
- components/ProductAdmin.tsx
- supabase/products_schema.sql

## 적용 후 확인 URL
- 고객 상품목록: /products
- 고객 상품상세: /products/demo-1 또는 등록상품 상세
- 관리자 상품관리: /admin/products

## Supabase 작업
Supabase SQL Editor에서 `supabase/products_schema.sql` 내용을 실행하세요.

## 주의
현재 RLS 정책은 빠른 MVP 테스트용으로 공개 쓰기 허용 상태입니다. 정식 오픈 전에는 관리자 인증 기반 정책으로 강화해야 합니다.
