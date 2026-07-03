# ReChair Photo Upload Real Update

상담 폼에 실제로 보이는 제품 사진 첨부 UI를 반영한 전체 프로젝트입니다.

## 반드시 확인할 파일

- `components/ConsultationForm.tsx`
- `app/api/consultations/route.ts`
- `app/globals.css`

## 적용 방법

GitHub ReChair 저장소에 압축파일 내용을 전체 덮어 업로드하세요.
Vercel이 자동 배포되면 상담 폼에 아래 영역이 표시됩니다.

- 앞면 사진
- 옆면 사진
- 모델명/제품라벨 사진
- 뒷면 사진
- 미리보기
- 모바일 카메라 촬영

## 참고

현재 API는 Supabase Storage가 연결되기 전까지 파일명을 수신하는 Mock 상태입니다.
다음 단계에서 Supabase Storage bucket을 연결하면 실제 이미지 저장까지 이어집니다.
