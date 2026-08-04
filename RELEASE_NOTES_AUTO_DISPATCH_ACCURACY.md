# ReChair Auto Dispatch Accuracy Update

## 변경 사항
- 자동배정 창에서 지역과 주소를 직접 입력 및 수정
- 입력한 지역과 주소로 추천 결과 즉시 재계산
- 고양, 파주, 김포, 경기 북부·남부 지역 별칭을 추천 점수에 반영
- 배정 완료 시 service_schedules와 consultations 양쪽에 지역·주소 저장
- 지역 또는 주소가 비어 있을 때 추천 정확도 안내 표시

## 확인 경로
관리자 → 자동배정 → 배정대기 상담 → 배정 계산

## 별도 작업
Supabase SQL 변경은 필요하지 않습니다.
