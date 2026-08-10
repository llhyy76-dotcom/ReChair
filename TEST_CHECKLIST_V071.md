# v0.7.1 테스트 체크리스트

1. Supabase SQL Editor에서 `supabase/v071_crm_products_rental_integration.sql` 실행
2. `/consult`에서 주소 검색 후 상담 등록 → 접수 완료 확인
3. `/admin/consultations`에서 동일 상담의 주소/지역 확인
4. 주소 수정 후 `위치 저장` → `/admin/dispatch-ai`에서 주소/지역 표시 확인
5. `/admin/products`에서 사진 없는 신규 상품 등록
6. `/admin/products`에서 사진 포함 신규 상품 등록
7. `/rental` 접속 → 개인용 / 영업용(코인형) 2개 카드 확인
8. 각 렌탈 상담 버튼 클릭 → 상담 폼 서비스 자동 선택 확인
