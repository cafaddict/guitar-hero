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

## D-019 tonal 6.4.3 고정(devDependency)
- 맥락: `tonal@6.5.0`(2026-09-28)의 package.json이 존재하지 않는 `dist/index.js`·`dist/index.d.ts`를 가리켜 Vite/Vitest에서 해석 실패.
- 결정: `tonal@~6.4.3`(파일 구조 정상)을 쓰고, 앱 런타임은 tonal을 쓰지 않으므로(보이싱 구성음 검증 테스트 전용) devDependency로 둔다. SPEC §4.1의 용도("코드 구성음 검증용")와 같다.

## D-020 파생 데이터 = attempt 재생(replay)
- 결정: `domain/derive.ts`의 순수 함수 `applyAttempt(state, attempt)`가 지표 샘플·스킬 상태·복습 큐(졸업 시 등록, 복습 시도 결과 반영)를 한 번에 갱신한다. 증분 저장(`Repository.recordAttempt`)과 `rebuildDerived()`가 같은 함수를 쓰므로 "재계산 = 증분"이 구조적으로 보장되고 테스트로도 확인한다.
- `toMetrics`는 플러그인(React) 대신 `domain/exerciseResults.ts`의 순수 추출기 레지스트리에 두고, 플러그인은 이를 위임 호출한다(Node에서 재계산 가능).
- 스킬 상태는 지표별 `count/last/best/recent(최근 10)/dayBest(일별 최고)`. "서로 다른 2일 ≥30"·"최근 3회 중앙값"·"최근 10회 clean"이 모두 여기서 계산된다.

## D-021 루틴 시간 배분(설계값)과 Stage 0
| 블록 | 초 |
|---|---|
| 튜닝 | 60 (Stage 0: 120) |
| 워밍업 | 60 (뮤트 스트럼) / 90 (Stage 4+ E7) |
| 코드 정밀 | 신규 90 + 최약 60 |
| 1분 체인지 | 60 × 2(+1), 사이 휴식 30 |
| 리듬 | 120 |
| 기술 | 60 (곡 9분이 보장될 때만) |
| 복습 슬롯 | ≤ 180 |
| 연습곡 | 540–600, 항상 마지막 |
- Stage 0은 코드가 없어 연습곡 블록 대신 튜닝 120 → 뮤트 스트럼 60 → 다이어그램 퀴즈 300 → 뮤트 스트럼 300 → 튜닝 연습 180 → 퀴즈 240(같은 항목 연속 금지 유지).
- 3일 초과 공백이면 코드 정밀 블록을 직전 스테이지 복습(직전 스테이지 신규 코드 E1 + 직전 스테이지 첫 focus 쌍 E2)으로 바꾼다. 튜닝·워밍업은 안전상 유지.
- 통증 ≥5: E1·E2 시간을 절반(15초 단위 반올림, 최소 30초)으로 줄이고 빈 시간은 채우지 않는다.

## D-022 진급 규칙 데이터 매핑
- "학습 쌍 ≥30"과 Stage 1·2·6의 "쌍 ≥30"을 모두 `unlockedPairsAtLeast {value 30, days 2}`(해금 코드의 25쌍 부분집합 전부가 서로 다른 2일에 ≥30)로 통일한다(SPEC §7.1 정의, 01 §5.4 E2 "단계 통과 = 서로 다른 2일").
- "코드 퀴즈 통과"는 `recallUnlocked`(해금된 모든 코드 클래스의 Q2 3초 내 정답 기록 ≥1회). G 두 보이싱은 클래스 'G' 하나.
- "연습곡 1곡 완주 자가 보고" = `countAtLeast song:* completed ≥1`. "P5 시도 기록" = `countAtLeast strum:P5 hitRate ≥0 1회`.
- 조건부 진급: 미충족 규칙이 쌍 규칙뿐이고 미충족 쌍 전부가 "21일 이상 연습 + 일별 최고값의 처음 3일 중앙값 대비 마지막 3일 중앙값 상승 < 2"일 때. 승급 시 해당 쌍을 `prescribedDrills`로 넘겨 다음 스테이지 루틴의 기술 블록에 E4를 처방한다.
- G 보이싱: Stage 6에서 G-2f가 습득(최근 10회 중 clean ≥5)되면 G-3f로 전환 제안.

## D-023 코칭 힌트 보완 규칙
- SPEC §6.7 표 외에 두 경우를 보수적으로 추가: (1) 개방현 MUTED인데 인접 줄에 손가락이 없음 → "손바닥이나 손가락이 닿지 않게"; (2) 개방현 기대인데 더 낮은 음 → "튜닝을 다시 확인". 인접 손가락이 양쪽에 있으면 저음 쪽(idx−1) 손가락을 먼저 지목한다(손가락 살이 고음 쪽 줄에 닿는 경우가 흔함).

## D-024 Mode B: 누설 인지 바닥 + 시간 모양 뮤트 판정 (dev 튜닝, SPEC §10.6 의미 유지)
- 맥락: 초기 구현(잡음 대비 SNR, T_PRESENT 12 / T_ABSENT 4 dB)은 dev split에서 깨끗한 스트럼 FAIL 95%. 원인 분석(`tools/bench/debug/modeB-*.ts`): (1) bin별 잡음은 광대역 SNR보다 ~40 dB 낮아, 강한 이웃 partial의 Hann 사이드로브(−31 dB)만으로도 "증거 20–50 dB"가 나와 x 줄·기대 밖 음 오탐; (2) 뮤트 줄은 창 [+40, +210]의 앞부분에 아직 에너지가 있어 절대 증거로는 울리는 약한 줄(이득 지터 ±6 dB)과 겹침.
| 선택지 | 결과(dev) |
|---|---|
| 절대 임계값만 조정 | 뮤트·오탐 분포가 겹쳐 불가 |
| 누설 모델 + 후기 창 절대 증거 | 울리는 줄도 창이 짧아져 4–14 dB 떨어져 분리 실패 |
| **누설 모델 + 같은 길이 초기/후기 창의 decay·상대 레벨** | 뮤트 검출 0.92, 깨끗 FAIL 1.5 % |
- 결정: §10 해설의 "salience ≥ T_PRESENT → OK, ≤ T_ABSENT → MUTED"를 "증거 ≥ T_PRESENT 그리고 지속 → OK, 시간 모양이 뮤트 → MUTED"로 구체화(3상태·줄 지목·베타 의미는 같음). 기대 밖 음 탐색은 잘못된 프렛 가설(±1·±2 반음)로 좁히고 임계값을 dev 분포로 정했다. 세부 수치는 `docs/DSP.md` §5.
- 트레이드오프: 신호 모델(정상 sustain vs −30 dB/120 ms)에 기대므로 실녹음에서 decay가 빠른 줄(나일론, 낡은 줄)은 RETRY가 늘 수 있다 → GuitarSet 소프트 지표로 확인(M3).

## D-025 Mode C: 직전 잡음 대신 국소 스펙트럼 포락선("peakiness")
- 맥락: 1분 체인지 시퀀스에서는 onset 직전 0.5 s에 이전 코드가 울린다. 이를 잡음으로 쓰면 같은 코드 재스트럼의 증거가 0이 되어 margin이 무작위가 되고(과대·과소 집계), 반향이 있으면 체인지 도착도 보류됐다(dev |오차| ≤ 1 비율 0.68).
- 결정: 각 partial의 증거를 같은 창의 국소 포락선(±1/3 옥타브 30-퍼센타일, 탐침 제외) 대비로 계산하고 h^−0.5 가중 평균. dev 0.975 / MAE 0.07 / 과대 0, 집합 분류 0.996.

## D-026 Onset: 시각 정밀화를 미세 log flux로, broadband·lag dev 튜닝
- 초기 고역 미분 포락선 임계값 정밀화는 additive 합성(부드러운 attack)에서 40 ms 이르게 잡혀 F1 0.69. 미세 log 스펙트럼 flux(10.7 ms/1 ms hop) 첫 교차 + dev 보정 5 ms로 교체. broadband 상승 +6 → +3 dB, flux lag 2 → 4 프레임에서 dev F1 0.98, 지속음 가짜 onset 0 %.
- 오프라인 `pickOnsets`는 스트리밍 `OnsetPicker`를 그대로 돌린다(worklet과 벤치마크가 같은 코드).

## D-027 벤치마크 실행 구조
- worker_threads 워커는 `tools/bench/worker-boot.mjs`에서 `tsx/esm/api`의 `register()`를 호출한 뒤 TS 워커를 import한다(`execArgv: ['--import','tsx']`는 Node 24의 내장 타입 스트리핑이 먼저 잡아 확장자 없는 import를 해석하지 못함).
- Mode A/B 판정은 벤치마크에서도 **검출된 onset**을 쓰고 [onset−500, onset+400] ms만 넘긴다(앱과 동일). 정답 onset을 주지 않는다.
- SNR 정의(§14.3-2)는 반향·HPF를 거친 신호의 onset+0..500 ms RMS ÷ HPF를 거친 정상 잡음 RMS. RTT 탐침은 짧은 버스트라 SNR 기준을 버스트 자체 길이로 둔다(20–40 dB 층화).
- 벤치마크 시퀀스에서 손 뮤트(체인지 직전 15 ms 페이드)를 모델링했다. Mode D 쉼 슬롯 추가 스트럼 12 %, 누락 6 %.

## D-028 M2 리뷰(code-reviewer) 반영
- 확인된 결함과 조치:
  1. 채널 모델의 LPF 8 kHz가 잡음 스케일링 **뒤**에 적용돼 실제 SNR이 표기보다 최대 ~4.6 dB 높았다 → LPF를 신호·잡음 각각에 먼저 적용하고 SNR을 잰다. 테스트는 최종 녹음에서 잡음 = 녹음 − 무잡음 녹음으로 SNR을 측정(white/pink × LPF on/off × HPF).
  2. Mode A/B/집합 분류 벤치마크가 정답 onset에 가장 가까운 검출 이벤트를 골랐다(정답 누설) → 앱과 같은 순수 함수 `src/dsp/take.ts selectTakeEvent`(첫 onset, +400 ms 안에 다른 onset이면 RETRY(MULTIPLE_ONSETS), 없으면 NO_ONSET)를 쓴다. 앱의 E1·Q2 러너도 이 함수를 쓴다.
  3. 튜너 벤치마크가 정답 onset에서 프레임을 시작했다 → 녹음 처음부터 연속 실행하고 안정까지 시간만 onset 기준으로 잰다. 그 결과 attack이 걸친 프레임이 안정 판정에 끼어 p95 3.34 cents(dev)가 되어, **attack 포함 프레임 거부**(앞 1/4 RMS가 뒤 1/4보다 6 dB 넘게 작으면 무효)를 튜너에 추가 → dev p95 1.85 cents. 실제 튜너에도 맞는 동작이다.
  4. 무결성 테스트: thresholds.json 키 ↔ 판정 키 **양방향** 일치(perf 포함, 파라미터 키는 명시 목록), SNR 층(Mode B 15 dB는 cleanFailMax에만, 튜너 20 dB 미만 제외) 검사, 시드 겹침 검사에 전 모드 포함, Mode B 조건별 최소 표본을 **판정 층(SNR ≥ 25) 안에서** 보장(조건당 600, SNR 조건 내 균등).
  5. 소스 스캔: side-effect·동적 `import()`·`require()` 형태, `OfflineAudioContext`, `.js/.mjs` 파일의 `Math.random`, `Math[...]` 계산 접근까지 잡도록 강화하고 패턴 자기 검사 테스트 추가.
  6. worklet 경로 할당: `FluxAnalyzer`는 프레임 객체 재사용, `OnsetPicker`는 고정 버퍼 삽입 정렬과 사전 할당 후보 객체(반환 객체는 다음 호출까지 유효, 보관 시 복사).
- 지적 중 의도된 차이로 남긴 것(문서화):
  - 클릭 마스킹 창은 ±(10 ms + 반 프레임): 후보 시각이 프레임 중심이라 반 프레임 오차를 흡수해야 한다. "클릭 템플릿 일치"는 2–4 kHz 대역 flux 비중 ≥ 0.4 + 1 kHz 미만 flux < 1.5로 근사한다(저역이 오르면 정박 스트럼으로 보고 유지).
  - Mode D 타이밍 오차 분포는 ±50 ms 안에 매칭된 검출만 쓴다(§14.3-9 "검출 스트럼"의 오차). 그보다 먼 검출은 F1@±25 ms에서 이미 벌점이다.
  - 판정기의 `performance.now()`는 결과의 `processingMs` 측정에만 쓴다(도메인 시간 로직이 아님, worklet 경로에는 없음).
  - Mode B는 T_ABSENT를 "스트럼이 충분히 큰가(기준 ≥ T_ABSENT + 15 dB)"에만 쓰고, 줄 MUTED는 decay·relLate 모양으로 판정한다(D-024).
- 추가 dev 튜닝: Mode B 증거는 기대 위치 ±tol cents 안의 **실제 국소 피크**만 인정(이웃 피크의 스커트는 증거 아님) → 잘못된 프렛 PASS 0.10 → 0.0025. x 줄 임계값 16 → 14 dB(깨끗 FAIL 불변, 검출 0.93). onset broadband 조건을 "향후 4프레임 최대 vs lag 이전 3프레임 최소"로(넓은 스트럼·SNR 15에서 고역 상승이 40 ms에 걸쳐 일어남) → Mode C dev 0.958 → 0.992.

## D-029 M3: onset 재튜닝(합성 dev + GuitarSet dev), 판정 가능 구간, detector 1.1.0
- 맥락: M2 onset 설정은 GuitarSet dev 플레이어에서 F1 0.734(하드 임계값 0.85). 분석·시도 전체는 `docs/DSP.md` §13.2.
- 결정: 프레임 85.3 ms·lag 8, broadband +1 dB/고역 flux ≥ 0.5, 상대 조건이 붙은 저역 경로, 기대 선행 억제(60–180 ms, ×4), 정밀화 lookback 40 ms. 합성 dev와 GuitarSet dev 양쪽에서 동시에 확인했다(한쪽만 맞춘 설정 금지 — 앱은 하나의 검출기를 쓴다). test split/test 플레이어는 튜닝 중 보지 않았다(`--dev-only`).
- 판정 가능 구간: GuitarSet 이벤트는 [onset−500 ms, onset+400 ms]가 녹음 안에 있을 때만 판정한다. SPEC §8.2·§10.5 입력 정의(onset 주변 −500…+400 ms)를 만족하지 못하는 클립 시작부(0.02–0.05 s) 음은 앱에서도 생길 수 없다(앱은 항상 녹음이 먼저 시작). 임계값·이벤트 필터는 그대로다.
- 단음 이벤트의 "앞 150 ms 안에 다른 노트 없음"은 "앞 150 ms 동안 울리는 다른 노트 없음"(더 엄격)으로 해석했다.
- 실시간 경로: 기대 선행 억제와 정밀화는 worker 쪽(구간을 받은 뒤)에서 적용한다 → 판정 지연 ≈ 180 ms + 프레임. E2 자동 카운트·E5 사후 채점에는 문제없다.
- detectorVersion 1.0.0 → 1.1.0.

## D-030 M3 첫 GuitarSet test 실행: Mode A 하드 지표 미달 → dev에서 재현·수정 (detector 1.2.0)
- 결과(test 플레이어 04–05, detector 1.1.0): Mode A OK 0.882(15/17) < 0.95, 나머지 하드(±1 반음 오수용 0, Mode C 0.980, onset F1 0.877)와 소프트(0.064 / 0.003) 통과. n = 17이라 한 건만 틀려도 0.941로 미달한다.
- 절차(SPEC §14.3-11을 GuitarSet에 준용): test 개별 사례는 보지 않고, dev 플레이어에서 같은 지표의 여유를 분석(`tools/guitarset/debug/modeA.ts`):
  - 실제 음의 decay 비율 최소 0.12(합성 정상 음은 ≥ 0.33) — 전역 MUTED 기준 0.10에 너무 가깝다. 합성 뮤트는 p99 0.05.
  - clarity 0.846·0.864(저음 F2 등) — 0.85 기준 언저리. 레벨 10.1 dB — LOW_LEVEL 기준 10 dB 언저리.
- 수정(전부 SPEC §10.5가 dev 튜닝 대상으로 둔 초기값): 전역 MUTED 비율 0.10 → **0.07**(관대; 보통 0.085, 엄격 0.10), clarity 0.85 → **0.80**, WEAK 레벨 +10 → **+7 dB**. 합성 dev Mode A 전 지표 유지(뮤트 오수용 0.005, 뮤트 검출 0.995, 오음 검출 0.995), GuitarSet dev 단음 39/39 OK.
- detectorVersion 1.1.0 → 1.2.0. 이후 test 재실행 결과는 `docs/BENCHMARK.md` test-run log와 GuitarSet 절에 남는다.

## D-031 Mode A 실녹음 강건성 (두 번째 GuitarSet test 실행 후, detector 1.3.0)
- 결과(detector 1.2.0): test Mode A OK 여전히 15/17. 실패 유형 분해만 확인(개별 사례는 보지 않음): WEAK 1, NOT_PLAYED 1. dev에서는 두 유형 모두 0건이라 dev 재현 대신 두 유형의 일반 원인을 막는 강건화를 넣고 dev에서 회귀가 없음을 확인했다.
- 수정:
  1. **두 번째 피치 창**: 첫 창 [+30, +130 ms]이 AMBIGUOUS/DETUNED이면 [+130, +330 ms]에서 다시 잰다(실제 attack은 피크 잡음·손가락 미끄러짐이 길 수 있다). MUTED 판정은 그 전에 끝나므로 뮤트 검출에는 영향이 없고, 다른 음은 두 번째 창에서도 다른 음으로 잡힌다.
  2. **pluck onset 폴백**(`src/dsp/take.ts energyOnset`): "n번 줄을 튕기세요" 직후 flux 검출기가 아무것도 못 잡으면 5 ms RMS가 직전 150 ms의 25-퍼센타일 레벨보다 +12 dB 넘게 30 ms 유지되는 첫 지점을 onset으로 쓴다(그다음 일반 정밀화). 앱 E1 한 줄씩 흐름과 합성·GuitarSet 벤치마크가 같은 함수를 쓴다. GuitarSet 흉내에서는 무장 = 주석 150 ms 전, 결과는 여전히 주석 ±60 ms 안이어야 한다. dev에서 flux 검출을 끄고 폴백만 써도 단음 38/39를 찾는다(기준선을 최솟값으로 두면 조용한 스튜디오 녹음에서 무장 직후 바로 터져 22/39였다).
- dev 결과: 합성 Mode A 전 지표 유지, GuitarSet dev 단음 39/39.
- detectorVersion 1.2.0 → 1.3.0(두 번째 피치 창·폴백 초판; test 16/17) → 1.3.1(폴백 기준선 25-퍼센타일·+12 dB·무장 150 ms 전).
- 세 번째 실행(1.3.1): test Mode A OK 17/17, 하드 4/4·소프트 2/2 통과. GuitarSet test는 총 3회 실행됐고 매번 test 개별 사례가 아닌 실패 유형만 보고 dev에서 고쳤다.

## D-032 M4 오디오 엔진 구조: 플랫폼 주입 + worklet→worker 직결 MessageChannel
- `AudioEngine`(src/audio/engine.ts)은 브라우저 API(AudioContext 생성, getUserMedia, enumerateDevices, worklet 모듈 로드·노드 생성, Worker 생성)를 `EnginePlatform`으로 주입받는다. 실제 바인딩은 `browserPlatform.ts`, 앱 단일 인스턴스는 `appEngine.ts`/`app/services.ts`. 근거: 권한 거부·장치 분리·OS 중단(interrupted)·getSettings 진단을 Node 단위 테스트(가짜 객체)로 검증하기 위해(AC-A1). Vite 전용 `?worker&url` import는 엔진 파일 밖에 둬 Vitest가 엔진을 직접 import할 수 있다.
- 데이터 경로: 마이크 → worklet(CaptureCore) —MessageChannel→ DSP worker(정밀화+판정) → main. 세그먼트(onset −500/+400 ms), 튜너 프레임, 요청 구간은 worklet이 풀에서 꺼낸 Float32Array를 **transfer**하고 worker가 `returnBuffer`로 되돌려준다(풀이 비면 1회 경고 후 할당). main은 큰 버퍼를 거치지 않는다.
- 캡처 샘플 n ↔ 컨텍스트 시각: worklet이 첫 블록에서 `currentFrame`을 `ready{startFrame}`으로 알린다 → t = (startFrame + n)/fs. 메트로놈 예약 시각·RTT 프로브·클릭 마스크가 모두 이 한 시계를 쓴다.
- 판정 작업(job)은 worker에 상태로 둔다(`setJob`): onsets / pluck(Mode A) / template(캘리브레이션) / strum(Mode B) / pair·set(Mode C). 튜너는 별도 on/off. 구간 분석(noise, rtt, raw)과 Mode D `analyzeTiming`은 id로 짝을 맞추는 요청/응답이다. 모든 응답에 `detectorVersion`·`processingMs`.
- 요청은 zod 판별 유니온으로 검증한다. zod 출력의 `nameKo?: string | undefined`가 `exactOptionalPropertyTypes`의 `ChordVoicing`과 맞지 않아, 보이싱은 transform으로 undefined 키를 지운다(단언 캐스트 없음).

## D-033 메트로놈: 앵커 기반 예약, 템포 변경·카운트인 규칙, 타이머 2종
- 클릭 시각 = 현재 템포 구간의 앵커(시각, 박 번호) + (박 − 앵커 박)·박 길이 (+ 서브디비전). 더하기 누적이 아니므로 10분 지터 시뮬레이션에서 오차 < 1e-9 s(`metronome.test.ts`). 늦게 깬 타이머도 그리드 시각 그대로 예약하고, 0.05 s 넘게 지난 클릭은 **소리만** 생략한다(1초 멈춤 뒤 클릭 폭주 방지, 그리드·판정용 목록에는 남김).
- 템포 변경은 "아직 예약하지 않은 다음 박"부터 적용(이미 예약된 클릭은 움직이지 않음). 카운트인 중 변경은 0마디부터 적용(그리드 원점 = 0마디 1박이 미리 정해져 판정 기준이 흔들리지 않게).
- 6/8은 8분음표 6개를 박으로 세고 4번째에 2차 악센트. 음소거 마디는 (play, mute) 주기, 카운트인은 항상 들림. 시각 전용 모드는 소리만 끄고 그리드·펄스는 그대로.
- 타이머: Worker 안 setInterval 25 ms + lookahead 0.1 s가 기본, Worker가 없으면 main setInterval 200 ms + lookahead 0.25 s(SPEC §8.4 두 값).
- 클릭 마스크: 들리는 최근 8개 클릭의 예상 도착 시각(예약 + RTT)을 worklet에 넘긴다.

## D-034 캘리브레이션 마법사 규칙 (SPEC §9.1 해석)
- 튜닝: 줄 모드 튜너의 안정 판정(5프레임 ±3 cents)이 나면 |δ| ≤ 15 cents 통과, 100 cents 넘게 벗어나면 "다른 음"(앞 줄 잔향 등)으로 보고 무시. 통과 후 0.6 s 쉬고 다음 줄.
- 샘플레이트 sanity: 각 줄의 **첫 안정 측정**(다른 음 제외)과 기대 주파수의 비율이 3줄 이상에서 서로 ±0.5% 안으로 균일하고 그 중앙값이 ±1% 밖이면 `SAMPLE_RATE_SUSPECT` 경고(흩어진 오차는 단순 조율 상태로 본다).
- 템플릿: 줄마다 Mode A가 OK로 판정한 튕김 3회 → harmonic 상대 크기(h=1..8, [+30, +130 ms]) 중앙값, decay 비율 중앙값. OK가 아닌 튕김은 "다시" 안내만 하고 세지 않는다.
- RTT: loopback 측정이 연속 2회 성공하고 차이 ≤ 3 ms면 평균을 저장(MAD는 둘 중 큰 값). 실패 2회 또는 3회 안에 합의 실패 → 탭 보정(카운트인 4 + 클릭 8개 @80 BPM, onset과 클릭의 중앙 오프셋, `tapRttStats`). 출력 장치 라벨이 블루투스로 보이면 바로 탭 보정. 측정 못 하면 값을 만들지 않는다(마법사를 끝낼 수 없고 "나중에 하기"만 가능).
- 소음: 2초 구간 전체 dBFS + 1/3옥타브(63 Hz–8 kHz) 대역별 100 ms 프레임 전력의 중앙값. −45 dBFS 초과면 경고 후 계속.
- 경고 코드(`NOISY`, `PROCESSING_ON`, `BLUETOOTH_INPUT`, `BLUETOOTH_OUTPUT`, `SAMPLE_RATE_SUSPECT`, `RTT_TAP`)를 `Calibration.warnings`에 저장하고 문구는 i18n에서 렌더.
- getSettings 진단은 마이크가 켜질 때마다 `meta.captureDiagnostics`에 저장하고(세션 진단), 캘리브레이션에는 `trackSettings`로 함께 저장한다. 진단 화면은 실시간 값이 없으면 저장된 값을 보여 준다.
- 첫 실행: 홈이 페이지 로드당 1회 `/onboarding`으로 보낸다. "나중에 하기"는 홈에 남고 홈 카드에서 다시 시작할 수 있다. "마이크 없이 쓰기"는 `micDisabled = true`.

## D-035 E2E 가짜 마이크 보강과 E2E-01 단언
- `MediaStreamAudioDestinationNode` 트랙의 label이 "MediaStreamAudioDestinationNode"라서 하네스가 트랙 label을 가짜 장치 이름으로 덮는다(enumerateDevices와 일치).
- E2E-01의 "같은 조건 2회 측정 차이 ≤ 3 ms"는 마법사의 RTT 측정을 **두 번**(처음 + "다시 측정") 실행해 두 결과를 비교한다. 추가로 모든 원시 loopback 시도가 [지연, 지연 + 30 ms] 안이어야 하고 방식은 loopback이어야 한다. 저장된 δ는 fixture 디튠과 ±3 cents 안이어야 한다(D-037 참조).
- tsx(esbuild keepNames)로 실행하는 도구가 `addInitScript(fn)`을 쓰면 페이지에 `__name` 헬퍼가 필요하다(`tools/devcheck/audio-dev.ts`). Playwright 테스트 러너에서는 불필요.

## D-036 AC-A5 증거: dev 서버 점검 도구 + worklet 모듈 Node 테스트
- `npx tsx tools/devcheck/audio-dev.ts`(`npm run check:audio-dev`): Vite dev 서버에서 TS worklet(src/dsp import), DSP module worker, 메트로놈 ticker worker가 모두 로드·동작하는지 Chromium + 가짜 마이크로 확인. verify에는 넣지 않는다(빌드 산출물 기준 E2E가 verify에서 돈다).
- `src/audio/captureProcessor.test.ts`: 실제 worklet 모듈을 worklet 전역을 흉내 낸 Node에서 실행 — 세그먼트 창·지연 조건, 튜너 프레임·구간 샘플 정확성, 20초 동안 풀 고갈 경고 0(=워밍업 후 블록 처리 무할당), 블록 평균 처리 시간 ≤ 0.3 ms(측정 ≈ 0.04 ms, 튜너 켬).

## D-037 렌더 끊김(process 누락) 시 캡처 시계 정렬 + E2E-01 RTT 반복성 단언
- 발견: 첫 M4 verify에서 E2E-01이 실패(원시 RTT 140.67 → 132.67 → 132.67 ms). worklet에 진단을 넣고 병렬 부하에서 재현하니 브라우저가 `process()`를 몇 블록(예: 512 frames) 건너뛰는 일이 실제로 있었고, 그 뒤 "캡처 샘플 n = 컨텍스트 프레임 startFrame + n" 매핑이 영구히 그만큼 어긋났다(RTT·그리드·onset 시각 전부 수 ms 이동). 앱 결함.
- 수정: worklet이 매 블록 `currentFrame − (startFrame + 처리한 샘플)`을 확인하고, 모자란 프레임은 `CaptureCore.fillGap()`으로 0을 채워 정렬을 유지한다. 구멍에서 신호로 돌아오는 점프는 strum이 아니므로 [구멍 −20 ms, 구멍 끝 +80 ms]의 onset을 버린다. main에는 `gap{frames}`를 보내 진단 화면에 "오디오 끊김 n회"로 보인다. 회귀 테스트: `captureProcessor.test.ts`(블록 4개 누락 후 onset·구간 샘플 위치 정확, 복귀 점프 미보고), `engine.test.ts`(끊김 집계).
- 남은 변동: 끊김이 없어도 가짜 loopback 경로(MediaStreamDestination → MediaStream → MediaStreamSource) 내부 FIFO 지연이 부하에서 3–7 ms 바뀌는 일이 있었다(예: 137.33 → 132.67 → 132.67, gapFrames 0). 실제 마이크 입력도 같은 MediaStream FIFO를 지나므로 제품에서도 생길 수 있는 변동이고, 마법사의 "연속 2회 3 ms 안 합의" 규칙이 이것을 흡수한다.
- 그래서 처음에 SPEC보다 엄격하게 둔 "첫 두 시도가 곧바로 합의" 단언(앱이 아니라 브라우저 FIFO를 검사)을 SPEC 문구 그대로의 단언으로 바꿨다: 마법사 RTT 측정 2회(처음 + "다시 측정")의 결과 차이 ≤ 3 ms, 두 결과 모두 [120, 150] ms, **모든 원시 시도**도 [120, 150] ms, 방식 loopback. 바꾼 뒤 전체 E2E를 병렬 4 workers로 `--repeat-each=3`, `--repeat-each=4` 두 번 돌려 42/42 통과.
