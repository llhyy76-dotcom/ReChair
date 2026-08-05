# ReChair OMS v0.5 — 기사 운영센터

## 추가 기능

- 기사관리 화면을 `기사 운영센터`로 개편
- 기준일별 기사 업무량 조회
- 오늘 배정·진행중·검토대기·승인완료·반려 건수 표시
- 기사별 일일 처리한도와 남은 처리 여력 표시
- 근무·휴무·연차·교육 상태 표시
- 기사 검색 및 상태 필터
- 자동배정·근무휴무·AS 캘린더 바로가기
- `/admin/technician` 접속 시 `/admin/technicians`로 자동 이동
- 기사관리 API에 관리자 인증 적용

## 신규 API

- `GET /api/admin/technicians/overview?date=YYYY-MM-DD`

## Supabase

- 기존 `technicians`, `service_schedules`, `technician_availability` 테이블을 사용합니다.
- 새 SQL 실행은 필요하지 않습니다.

## 확인 경로

- `/admin/technicians`
- `/admin/technician` (자동 이동)

## 확인 시나리오

1. 관리자 로그인
2. 상단 `기사관리` 클릭
3. 기준일 변경
4. 기사별 당일 배정 및 처리여력 확인
5. `근무·휴무 설정`에서 휴무 등록
6. 기사 운영센터로 돌아와 휴무 상태 반영 확인
7. 자동배정에서 휴무 기사가 제외되는지 확인
