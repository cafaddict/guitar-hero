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
| `npm run check:audio-dev` | dev 서버에서 AudioWorklet·DSP worker·메트로놈 worker 로드 점검 |

## 지금 되는 것 (M4까지)

- 처음 설정(캘리브레이션) 마법사: 마이크 권한·장치, 주변 소음, 6줄 튜닝(±15 cents), 줄별 소리 템플릿, 지연(RTT: 스피커 루프백 → 실패 시 탭 보정)
- 튜너(줄 모드·크로매틱), 메트로놈(BPM 30–240, 탭 템포, 박자·세분, 카운트인, 음소거 마디, 시각 전용, 자동 정지, 템포 사다리)
- 설정 > 진단: 입력 레벨, 브라우저가 실제 적용한 마이크 설정(getSettings), 입력 장치 선택, 최근 캘리브레이션

(문서는 M8에서 완성합니다.)
