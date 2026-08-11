# ReChair OMS v0.8.1

## 렌탈 설치 운영 연동

이번 버전은 렌탈 계약 이후의 설치 업무를 기존 AS 현장 운영 시스템에 안전하게 연결합니다.

### 주요 변경

- 렌탈 상세에 `설치 일정·기사 연동` 영역 추가
- 설치 담당기사와 예상 설치시간 지정
- 렌탈 설치 일정을 현장 캘린더와 기사 모바일 화면에 동시 생성
- 캘린더/기사 화면에 `렌탈 설치` 작업 유형 표시
- 설치 일정 변경 시 렌탈 설치 예정일 자동 동기화
- 기사 작업보고 최종 제출 후 관리자 검토대기 유지
- 관리자 승인 시 렌탈 단계를 `운영중`으로 자동 전환
- 관리자 반려 시 `설치예약` 유지 및 기사 화면에 반려 사유 표시
- 렌탈 상담에서 일반 AS 일정 생성 버튼을 숨겨 중복 일정 방지
- 승인 완료된 일정의 임의 수정 방지

### DB 변경

- `service_schedules.schedule_kind`
- `consultations.rental_installation_completed_at`
- `consultations.rental_operating_started_at`
- 렌탈 상담당 활성 설치 일정 1건 제한

### 빌드 검증

- Next.js 15.5.20 production build 성공
- TypeScript 검사 성공
- 46개 정적 페이지 생성 성공

