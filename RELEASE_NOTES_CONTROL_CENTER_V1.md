# ReChair 현장 관제센터 v1

- 기사 모바일 화면에서 명시적으로 위치 공유 시작/종료
- 공유 중 GPS를 약 30초 간격으로 서버에 갱신
- 관리자 관제센터에서 기사별 최신 위치와 갱신 시각 확인
- 실시간/최근/오래됨/미공유 상태 구분
- 카카오맵에서 위치 열기 및 기사 전화 연결
- 기사 동의 없이 백그라운드 위치 추적하지 않음

## 적용 전 SQL
Supabase SQL Editor에서 `supabase/v14_technician_live_locations.sql`을 실행합니다.

## 확인 주소
- 기사 모바일: `/technician`
- 관리자 관제센터: `/admin/control-center`
