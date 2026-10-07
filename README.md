# guitar-hero — 기타 연습 (v1, 개발 중)

완전 초보 성인이 어쿠스틱 기타를 체계적으로 배우도록 매일의 연습 루틴을 짜 주고, 마이크로 듣고 정직하게
피드백하며, 진도를 숫자로 보여 주는 local-first 웹앱입니다. 명세: [`docs/goal/SPEC.md`](docs/goal/SPEC.md).

## 요구 사항

- Node.js ≥ 22.12 (개발 확인: 24.3), npm 11
- E2E: `npx playwright install chromium webkit`

## 스크립트

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (localhost) |
| `npm run dev:https` | 같은 Wi-Fi의 iPad/iPhone 접속용 HTTPS 개발 서버 |
| `npm run build` / `npm run preview` | 정적 빌드 / 프리뷰 |
| `npm run typecheck` · `lint` · `test` | 타입체크 · Biome · Vitest |
| `npm run licenses` | 프로덕션 의존성 라이선스 검사 |
| `npm run fixtures:generate` | E2E용 WAV fixture 결정적 생성 |
| `npm run test:e2e` | Playwright E2E |
| `npm run verify` | 전체 품질 게이트 + 요약표 (`bench-results/verify-summary.txt`) |

(문서는 M8에서 완성합니다.)
