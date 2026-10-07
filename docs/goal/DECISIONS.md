# DECISIONS — guitar-hero v1

> 형식: `D-NNN 제목` / 날짜 / 맥락 / 선택지 / 결정 / 결과·트레이드오프. goal 실행자는 SPEC에 없는 선택이나 SPEC과 다른 선택을 할 때 여기에 추가한다(사용자에게 질문하지 않는다).
> D-001–D-010은 goal 시작 전 사용자와 합의한 결정이다(2026-10-07 세션).

## D-001 대상 사용자와 악기
- 맥락: 사용자 답변 — 완전 초보, 어쿠스틱(통기타), MacBook·iPad·iPhone 모두 사용.
- 결정: Stage 0부터 시작하는 초급 커리큘럼. 스틸 줄 어쿠스틱 + 기기 내장 마이크를 1차 대상으로 DSP를 튜닝한다.

## D-002 자체 커리큘럼 (특정 강사 콘텐츠 연동 없음)
- 선택지: 강의 영상 임베드 / 링크만 / 자체 커리큘럼.
- 결정: 자체 커리큘럼. 연습 방법(1분 코드 체인지, 한 줄씩 확인 등)은 일반 명칭과 앱 자체 문구로 구현하고, 연습곡은 앱이 창작한 코드 진행으로 한다.

## D-003 데이터: local-first + JSON 내보내기
- 선택지: 로컬 + JSON / 클라우드 동기화(Supabase 등) / 단일 기기.
- 결정: 기기별 IndexedDB(Dexie) + JSON 내보내기/가져오기. 동기화는 v2. 데이터 모델은 append-only Attempt라 나중에 동기화를 붙이기 쉽다.

## D-004 배포: 정적 호스팅 준비만
- 결정: goal은 빌드 산출물, `_headers`/`vercel.json`, `docs/DEPLOY.md`, `dev:https`까지만 만든다. 실제 배포는 사용자가 goal 이후 직접 한다.

## D-005 Git: 별도 브랜치에서 마일스톤마다 커밋
- 결정: `feat/practice-app-v1`에서 마일스톤 종료 시 커밋. push·main 병합 금지. (사용자 전역 규칙 "자동 커밋 금지"의 예외로 사용자가 이 goal에 한해 승인)

## D-006 DSP 구현 언어: 순수 TypeScript
| 선택지 | 장점 | 단점 |
|---|---|---|
| TypeScript | Node 테스트와 브라우저가 같은 코드, 빌드 단순, GPL 회피 | 이론상 느림(실측상 충분) |
| C++ → WASM | 사용자에게 익숙, 성능 여유 | Emscripten 빌드 체인, worklet 로딩 번거로움 |
| Rust → WASM | 안전성 | 빌드 체인 추가 |
- 결정: v1은 TypeScript. 프로파일로 필요가 증명된 커널만 v2에서 WASM. (리서치 02 §6)

## D-007 판정 철학: 인식이 아니라 검증, 3상태 판정
- 결정: 앱은 목표 보이싱을 알고 있으므로 "무슨 코드인가"가 아니라 "기대한 음이 울렸나"를 검증한다. 판정은 PASS/FAIL/RETRY. 확신 없으면 RETRY. 스트럼 모드는 독립 partial이 있는 줄만 판정(베타), 확정 판정은 한 줄씩 모드. (리서치 02 §2.c–2.d)

## D-008 스택
- 결정: Vite 8 + React 19 + TS 7(strict) + Tailwind 4 + Dexie 4 + Zustand 5 + Zod 4 + svguitar + Recharts 3 + vite-plugin-pwa 1.3 + Vitest 5 + Playwright 1.63 + Biome 2. 이유: 병목은 오디오 파이프라인이라 UI 프레임워크 성능 차이가 결정적이지 않고, SvelteKit 3·Solid 2는 메이저 전환 직후/직전이라 위험. (리서치 03 §4.2)

## D-009 품질 계약 고정
- 결정: 테스트 임계값·매트릭스는 `docs/goal/thresholds.json`에 고정하고, goal 조건문에 SPEC.md·thresholds.json의 SHA-256을 넣어 실행 중 변경을 막는다. 합성 벤치마크는 dev/test split을 분리한다.

## D-010 UI 언어
- 결정: 한국어 UI(존댓말), 문자열은 `src/i18n/ko.ts`에 모은다(나중에 다국어 확장 가능). 음악 용어는 관용 표기.

---
<!-- goal 실행자 결정은 D-011부터 아래에 추가 -->

## D-011 턴 상한 300 → 1000 (사용자 지시)
- 날짜: 2026-10-07 (M0 진행 중)
- 맥락: goal 실행 중 사용자가 "300턴 말고 1000턴으로 변경"이라고 지시했다. SPEC §2.6(합계 300)·§16.1(턴 240 이후 축소 허용)은 SPEC 수정 금지 규칙 때문에 문서를 고치지 않는다.
- 결정: 전체 상한을 **1000턴**으로 운용한다. 마일스톤별 소프트 예산은 SPEC §2.6 비율 그대로 늘린다(약 ×3.33). §16.1 DEFERRABLE 축소는 같은 비율로 **턴 800 이후**에만 고려한다(범위를 덜 줄이는 보수적 선택).
- 트레이드오프: 실행 시간이 길어지지만 범위 축소 가능성이 줄어든다. goal 조건문 자체의 "300턴" 문구는 사용자가 `/goal`을 다시 설정해야 바뀐다.

## D-012 라우팅: react-router 8, hash 라우터
| 선택지 | 장점 | 단점 |
|---|---|---|
| react-router 8 `createHashRouter` | 정적 호스트 4종(GitHub Pages 포함)에서 SPA 재작성 규칙 없이 동작, `VITE_BASE` 하위 경로와 무관 | URL에 `#` |
| react-router BrowserRouter | 깔끔한 URL | GitHub Pages는 404 fallback 꼼수 필요 |
| TanStack Router | 타입 안전 | 화면 10개 규모에 과함 |
- 결정: react-router 8 hash 라우터. 테스트용 `?timeScale`은 `location.search`와 hash 쿼리 둘 다에서 읽는다.

## D-013 코드 다이어그램: svguitar 대신 자체 SVG 컴포넌트
- 맥락: `svguitar@2.8.0`이 Node 렌더링용 `svgdom` → `sax@1.6.1`(BlueOak-1.0.0)을 프로덕션 의존성으로 끌어온다. BlueOak는 허용적이지만 SPEC §2.4 허용 목록(MIT/BSD/ISC/Apache-2.0/0BSD/MPL-2.0/CC0/Unlicense)에 없다.
| 선택지 | 장점 | 단점 |
|---|---|---|
| svguitar 유지 + 허용 목록에 BlueOak 추가 | 구현 시간 절약 | SPEC 허용 목록 위반, 번들에 불필요한 svgdom |
| 자체 React SVG 컴포넌트 | 라이선스 문제 없음, 왼손잡이 미러·고대비 테마·접근성 제어 쉬움 | 약 150줄 구현 |
- 결정: svguitar 제거, `src/ui/ChordDiagram.tsx` 자체 구현(세로형, 손가락 번호, x/o, 바레, 왼손잡이 미러). SPEC §4.1 의미(세로형·손가락·x/o·바레·미러)는 유지.

## D-014 AudioWorklet TS 번들 방법 (M0 스파이크 1)
- 결과: `import url from './worklet/capture-processor.ts?worker&url'` + `ctx.audioWorklet.addModule(url)`이 Vite 8 dev(모듈 변환 서빙)와 build(별도 `assets/capture-processor-*.js` 청크) 양쪽에서 동작함을 확인. dev는 Playwright로 `vite` 서버에서 레벨 메시지 수신을 확인, build는 `tests/e2e/spike.mic.spec.ts`.
- worklet은 `tsconfig.worklet.json`(lib ES2023 + `@types/audioworklet`)으로 따로 타입체크한다(DOM lib와 전역 충돌 방지). `@types/audioworklet`의 `AudioWorkletProcessor`에는 `process`가 선언돼 있지 않아 `override`를 붙이지 않는다.

## D-015 E2E 가짜 마이크 하네스 (M0 스파이크 2·3)
- 스파이크 2: SPEC §14.5 설계대로 `AudioContext` 생성자를 감싸 앱 컨텍스트를 잡고 `getUserMedia`가 같은 컨텍스트의 `MediaStreamAudioDestinationNode.stream`을 돌려준다. WAV를 `__fakeMic.play(url, {at})`로 흘리면 worklet RMS로 관측됨(통과).
- fixture는 preview 서버가 `dist-e2e`만 서빙하므로 `page.route('**/fixtures/**')`로 `tests/fixtures/generated/`에서 응답한다. 서비스 워커가 `page.route`를 우회하므로 Playwright 기본값을 `serviceWorkers: 'block'`으로 두고, PWA 오프라인 테스트(E2E-09)만 `allow`로 바꾼다.
- 스파이크 3: `chromium-fake-capture` 프로젝트에서 `--use-file-for-fake-audio-capture=<abs>.wav%noloop`로 실제 getUserMedia 경로의 레벨 관측 확인(통과).
- WebKit(Playwright webkit)이 이 macOS에서 실행됨을 확인 → `webkit-ipad`/`webkit-iphone` 프로젝트는 WebKit 그대로 사용.

## D-016 한글 문자열 위치 규칙
- 결정: UI 문구는 `src/i18n/ko.ts`, 콘텐츠 데이터(스테이지 이름·설명·팁, 연습곡 제목)는 `src/content/`에 둔다. 무결성 테스트는 `src/` 전체에서 `i18n/`·`content/`·테스트 파일 밖의 한글(주석 제외)을 금지한다(SPEC §14.6-4의 "컴포넌트 TSX"보다 넓게 — 더 엄격한 쪽).
- 도메인 규칙(코칭 힌트 등)은 문구가 아니라 코드+파라미터를 반환하고, 문구 렌더링은 `ko.ts`의 함수가 한다.

## D-017 테스트 훅 제거 방식
- 결정: Vite `define`의 빌드 상수 `__GH_E2E__`(e2e 모드에서만 true)로 `window.__gh_test`·`timeScale` 코드를 감싼다. 프로덕션 빌드에서는 상수 false 분기가 minifier에 의해 제거된다(E2E-14가 `dist/` 문자열 스캔으로 확인). SPEC §11.1 예시의 `import.meta.env.VITE_E2E`와 의미가 같다.

## D-018 TS 도구 실행기: tsx
- 결정: `tools/*.ts`(verify, bench, fixtures, licenses)는 `tsx`(MIT, dev 의존성)로 실행한다. Node 24의 타입 스트리핑은 확장자 없는 import를 처리하지 못해 앱 코드와 import 규약이 달라진다.
