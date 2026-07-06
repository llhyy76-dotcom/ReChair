# ReChair Admin CRM UI v1

적용 파일:
1. `app/admin/page.tsx` -> 기존 파일 덮어쓰기
2. `css-patch/append-to-app-globals.css` 내용 -> `app/globals.css` 맨 아래에 추가

주의:
- `app/globals.css` 전체를 덮어쓰지 말고, 맨 아래에 CSS만 추가하세요.
- 적용 후 GitHub Commit -> Vercel 자동 배포 -> Ready 확인
- 확인 주소: /admin
