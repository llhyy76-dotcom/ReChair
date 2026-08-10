# ReChair OMS v0.7.0 - CRM 방문 위치

## 실제 구현
- 상담 상세에 `방문 위치` 카드 추가
- 다음(카카오) 우편번호 주소검색 버튼 추가 (별도 API 키 불필요)
- 도로명 주소 선택 시 `전체 주소` 자동 입력
- 주소에서 `지역` 자동 추출 (예: 경기도 고양시 덕양구 → 고양시 덕양구)
- 주소/지역을 consultations 테이블에 실제 저장
- AS 일정 생성 창에 `지역` 입력 추가
- AI 배정 준비 상태 표시

## 적용 전 DB 작업
Supabase SQL Editor에서 `supabase/v070_crm_visit_location.sql`을 1회 실행합니다.
