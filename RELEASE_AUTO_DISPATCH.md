# ReChair Smart Auto Dispatch MVP

## 적용 기능

- 방문일시와 예상 소요시간을 기준으로 기사 추천
- 담당지역 일치 점수
- 선택일 기사별 일정 수 및 일일 처리한도 계산
- 기존 일정과의 시간 충돌 검사
- 처리한도 초과 기사 자동 제외
- 추천 후보 최대 8명 비교 및 관리자의 최종 선택
- 실제 일정 저장 직전 서버에서 충돌과 처리한도 재검증
- 한국시간 기준 일자 집계

## 변경 파일

- `lib/dispatchRecommendation.ts`
- `app/api/admin/dispatch/recommend/route.ts`
- `app/api/admin/dispatch/overview/route.ts`
- `app/api/admin/consultations/[id]/schedule/route.ts`
- `components/AdminDispatchBoard.tsx`
- `app/admin/dispatch/dispatch.css`

## DB 변경

이번 MVP에는 별도 SQL 변경이 필요하지 않습니다.
기존 `technicians.daily_capacity`, `technicians.region`, `service_schedules` 데이터를 사용합니다.

## 확인 방법

1. 관리자 로그인
2. `/admin/dispatch` 접속
3. 배정대기 상담에서 `배정 계산` 선택
4. 방문일시 및 예상 소요시간 입력
5. `기사 추천 계산` 클릭
6. 충돌 없는 추천 후보를 선택
7. 배정 후 `/admin/schedule`에서 일정 생성 확인

## 주의

정확한 도로 거리 계산은 지도 API가 필요하므로 이번 MVP에는 포함하지 않았습니다.
현재는 담당지역, 당일 업무량, 시간 충돌, 일정 간격을 기준으로 계산합니다.
