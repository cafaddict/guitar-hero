# guitar-hero — 기타 연습 (v1)

완전 초보 성인이 어쿠스틱 기타를 체계적으로 배우도록 **매일의 연습 루틴을 짜 주고, 마이크로 듣고 정직하게
피드백하며, 진도를 숫자로 보여 주는** local-first 웹앱(PWA)입니다. MacBook, iPad, iPhone 브라우저에서 동작하고
기록은 모두 내 기기 안에만 남습니다. 명세: [`docs/goal/SPEC.md`](docs/goal/SPEC.md).

## 무엇을 할 수 있나

- **처음 설정**: 마이크 권한·장치, 주변 소음, 6줄 튜닝(±15 cents), 줄별 소리 템플릿, 지연(RTT: 스피커 루프백, 안 되면 클릭에 맞춰 치기)
- **오늘의 루틴 → 세션 러너**: 튜닝 → 워밍업 → 코드 → 1분 체인지 → 리듬 → 기술 → 연습곡(항상 마지막). 30분마다 휴식 알림, 끝나면 통증·난이도 자가 평가
- **연습 13종**: E0 튜닝, E1 코드 정밀 체크(한 줄씩 판정·스트럼 베타·수동·귀 먼저), E2 1분 코드 체인지(첫 스트럼으로 자동 시작, 자동/탭/직접 카운트), E4 앵커·공중 체인지, E5 스트러밍 패턴 사다리, E6 박 1 체인지, E7 손가락 스트레칭, E8 한 줄 교대 피킹, Q1 다이어그램 퀴즈, Q2 코드 기억 퀴즈, Q3 개방현 음이름, Q4 메이저/마이너 귀 훈련, S 연습곡(학습/연주 모드)
- **커리큘럼** Stage 0–7(8–11은 미리보기), 데이터로 정의된 진급 기준과 진행 상황, **초급 1 졸업 시험**(항목별 통과 기록)
- **진도**: 주간 연습 시간, 쌍별 1분 체인지 추이, 코드×줄 깨끗 비율, 패턴별 최고 BPM, 타이밍 평균·흔들림, 세션 기록, 간격 반복 복습 큐
- **도구**: 튜너(줄 모드·크로매틱), 메트로놈(탭 템포, 박자·세분, 카운트인, 음소거 마디, 시각 전용, 템포 사다리), 코드 라이브러리(다이어그램·기대 음·들어 보기)
- **마이크가 없거나 거부돼도** 모든 연습을 수동·자가 판정으로 진행할 수 있습니다. 마이크 판정은 보조 수단이고, 내 귀가 먼저예요.

## 요구 사항

- 사용: 최신 Chrome / Safari(iPad·iPhone은 Safari), **HTTPS 또는 localhost**(마이크·화면 꺼짐 방지·오프라인에 필요)
- 개발: Node.js ≥ 22.12(확인: 24.3), npm 11. E2E는 `npx playwright install chromium webkit`
- 실녹음 벤치마크(`bench:guitarset`)는 처음 실행 때 GuitarSet(Zenodo, 약 700 MB 내려받기, 풀면 약 2 GB)을 `data/`로 내려받습니다.

## 스크립트

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (localhost) |
| `npm run dev:https` | 같은 Wi-Fi의 iPad/iPhone 접속용 HTTPS 개발 서버(자체 서명 인증서) |
| `npm run build` / `npm run preview` | 정적 빌드(`dist/`) / 프리뷰 |
| `npm run typecheck` · `lint` · `test` | 타입체크 · Biome · Vitest |
| `npm run bench:dsp:dev` · `bench:dsp` | 합성 벤치마크(dev split: 튜닝용 / test split: 판정) |
| `npm run bench:guitarset` | GuitarSet 실녹음 벤치마크(dev 00–03 / test 04–05) |
| `npm run bench:real` | 녹음 키트로 만든 내 기기 fixture 벤치마크(`tests/fixtures/real/<기기>/`, 없으면 "no fixtures") |
| `npm run fixtures:generate` | E2E용 WAV fixture 결정적 생성 |
| `npm run test:e2e` | Playwright E2E(가짜 마이크·실제 getUserMedia·iPad/iPhone WebKit) |
| `npm run licenses` | 프로덕션 의존성 라이선스 검사(GPL/AGPL 금지) |
| `npm run verify` | 전체 품질 게이트 + 요약표(`bench-results/verify-summary.txt`). 게이트의 벤치 보고서는 `bench-results/BENCHMARK.md`에 쓰고, `docs/BENCHMARK.md`는 `bench:dsp`·`bench:guitarset`를 직접 실행할 때 갱신된다 |
| `npm run check:audio-dev` | dev 서버에서 AudioWorklet·DSP worker·메트로놈 worker 로드 점검 |
| `npx tsx tools/icons/generate.ts` | 앱 아이콘(SVG·PNG) 다시 만들기 |

## iPad에서 쓰는 법

1. Safari로 배포 주소(또는 `npm run dev:https`의 Network 주소)를 엽니다.
2. 공유 → **홈 화면에 추가**. 홈 화면의 "기타" 앱으로 열면 전체 화면이고, 한 번 연 뒤에는 오프라인에서도 열립니다.
3. 처음 설정에서 마이크를 허용하고, 기기를 기타에서 30–60 cm 떨어진 곳에 둡니다(블루투스 이어폰 마이크 대신 내장 마이크).
4. 손이 기타 위에 있을 때는 키보드나 블루투스 페이지 터너 페달로 조작합니다: Space·PageDown(→) 시작, 끝나면 Space 다시 하기·PageDown(→)·Enter 다음 항목, PageUp(←) 이전 항목, ↑↓ 보정, 1/2/3 수동 판정, Esc 중단(한 번 더 눌러 확인). 페달 버튼은 설정 > 키·페달에서 원하는 동작에 연결할 수 있습니다.

자세한 배포·설치 절차: [`docs/DEPLOY.md`](docs/DEPLOY.md). 실기기 검증 순서: [`docs/MANUAL_VALIDATION.md`](docs/MANUAL_VALIDATION.md).

## 데이터와 백업

- 모든 기록은 브라우저 IndexedDB(연습 기록·설정·캘리브레이션)와 OPFS(녹음 키트 오디오)에 저장되고, 서버로 보내지 않습니다.
- 시작할 때 브라우저에 저장소 보호(`storage.persist`)를 요청합니다. 그래도 Safari는 데이터를 지울 수 있으니 **설정 → 백업 → 내보내기**(JSON 파일)를 가끔 하세요. 마지막 백업 후 7일이 지나면 홈에 알림이 뜹니다.
- 가져오기는 미리보기(테이블별 건수) 후 **합치기**(같은 기록은 건너뜀) 또는 **바꾸기**(2단계 확인)입니다. 연습 기록(Attempt)은 추가만 되고 수정·삭제되지 않으며, 지표·스킬·복습 큐는 기록에서 언제든 다시 계산됩니다.

## 아키텍처 요약

```
UI(React) ─ 연습 플러그인 러너·세션 러너·진급 ─ AudioEngine ─┬─ AudioWorklet(캡처·onset)
                                                            └─ DSP Worker(판정) ─ src/dsp(순수)
데이터: Dexie(IndexedDB) · 콘텐츠·규칙: src/content(시드+zod) · 음악 이론·규칙: src/domain(순수)
```

- 판정기(Mode A 한 줄씩, Mode B 스트럼 베타, Mode C 코드 분류, Mode D 타이밍, 튜너, RTT)는 의존성 없는 TypeScript 순수 함수이고, 합성 벤치마크(dev/test split)와 공개 실녹음 데이터셋(GuitarSet)으로 임계값을 검증합니다.
- 연습 종류는 플러그인(params/result 스키마 + 러너 + 화면)이라 코어 수정 없이 추가할 수 있습니다.

자세히: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · DSP 파라미터와 근거: [`docs/DSP.md`](docs/DSP.md) · 측정 결과: [`docs/BENCHMARK.md`](docs/BENCHMARK.md) · v2 계획: [`docs/BACKLOG.md`](docs/BACKLOG.md) · 결정 기록: [`docs/goal/DECISIONS.md`](docs/goal/DECISIONS.md)
