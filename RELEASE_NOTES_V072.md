# ReChair OMS v0.7.2

## Fixed
- v0.7.1에서 consultations.css가 위치 입력 스타일만 남으면서 CRM 전체 레이아웃이 기본 HTML처럼 깨지는 문제 복구.
- CRM에서 저장한 주소/지역이 AI 배정 화면에서 다른 중복 상담 건 때문에 '지역 미입력'으로 보이는 혼동 개선.
- CRM -> AI 배정으로 정확한 consultation_id를 전달하고 AI 센터에서 해당 상담을 우선 표시.
- 모바일/Kakao 인앱 브라우저에서 헤더와 Hero가 과도하게 커지거나 가로 폭이 잘리는 현상 완화.

## Added
- CRM 상세에 [AI 배정] 버튼.
- 홈 Hero에 큰 '안마의자 렌탈' 배너.
- 렌탈 배너에서 개인용 / 영업용(코인형) 구분 노출.
- Header/Hero 전용 v0.7.2 responsive CSS modules.
- explicit device-width viewport 설정.

## DB
- DB migration 없음.
