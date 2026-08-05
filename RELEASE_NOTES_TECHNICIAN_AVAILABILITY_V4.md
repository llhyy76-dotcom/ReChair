# ReChair Auto Dispatch v4 — 기사 근무·휴무 반영

## 추가 기능
- 기사별 날짜 단위 근무, 휴무, 연차, 교육 등록
- 근무일의 시작·종료시간 설정
- 자동배정 추천에서 휴무·연차·교육 기사 자동 제외
- 근무시간 밖의 일정 자동 제외
- 실제 배정 직전 서버에서 다시 근무 가능 여부 검증
- 별도 설정이 없는 기사는 기존처럼 기본 근무로 처리

## 적용 전 필수
Supabase SQL Editor에서 다음 파일을 한 번 실행합니다.

`supabase/v13_technician_availability.sql`

## 확인 경로
- `/admin/technician-availability`
- `/admin/dispatch`
