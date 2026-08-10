# ReChair v0.7.5 테스트 체크리스트

## 적용

- [ ] `supabase/v075_privacy_security_hardening.sql` 실행 결과 Success
- [ ] 패치 파일을 같은 경로에 덮어씀
- [ ] GitHub Commit 및 Push 완료
- [ ] Vercel 배포 상태 Ready

## 렌탈 상담

- [ ] 개인용 렌탈 상담에 제품 사진 업로드가 보이지 않음
- [ ] 영업용(코인형) 렌탈 상담에 제품 사진 업로드가 보이지 않음
- [ ] 렌탈 상품에서 상담 버튼을 눌러도 제품 사진 업로드가 보이지 않음
- [ ] 렌탈 상담 접수 후 관리자 CRM에 상품명과 고객정보가 표시됨

## 일반 상담

- [ ] 중고판매·출장수리·부품구매에는 선택형 사진 업로드가 보임
- [ ] JPG·PNG·WEBP 사진 등록 성공
- [ ] 10MB 초과 또는 허용하지 않은 파일은 차단됨
- [ ] 관리자 로그인 후 상담사진이 정상 표시됨

## 개인정보 보호

- [ ] 상담 화면에 목적·필수/선택 항목·보유기간·거부 안내가 표시됨
- [ ] 동의하지 않으면 접수 불가
- [ ] `GET /api/consultations` 응답이 405
- [ ] `PATCH /api/consultations/{id}` 응답이 405
- [ ] 로그아웃 상태에서 `/api/admin/consultations` 응답이 401
- [ ] 로그아웃 상태에서 상품 등록·수정·삭제 API 응답이 401

## 빌드

- [x] `npm run build` 성공
- [x] TypeScript 및 Next.js 페이지 41개 생성 성공

