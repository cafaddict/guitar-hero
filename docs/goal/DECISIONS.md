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

## D-038 M5 플러그인 골격
- 계약은 SPEC §11.1 그대로(`src/exercises/types.ts`): `ExercisePlugin<P, R, V>` + `ExerciseRunner<R, V>`. `ExerciseContext.audio`(SPEC의 `AudioEngineApi | null`)는 **마이크 쪽**(`ExerciseMic`: job, 판정 이벤트, coarse onset, 튜너, pluck fallback, analyzeTiming)이고, 마이크 없이도 필요한 출력(메트로놈·합성 재생·오디오 시계)은 `ctx.output`으로 분리했다(마이크 없는 E5·Q4·S도 메트로놈/합성은 써야 하므로).
- `ctx.clock.now()`는 시뮬레이션 ms(`performance.now() × 배율`, 배율은 E2E 빌드의 `?timeScale=`만, `src/app/testRate.ts`). DSP 이벤트 시각은 오디오 시계 초.
- 레지스트리(`registry.tsx`)는 `definePlugin`이 제네릭을 지우고 경계에서 각 플러그인의 zod로 params·result를 검증한다. 러너→뷰의 정확한 타입은 WeakMap으로 되찾아 캐스트가 없다. 다른 플러그인의 러너를 넘기면 예외.
- `BaseRunner`: 스냅샷 발행, 시계 차이 타이머(일시정지 포함), 소유 구독 해제, DSP 통계(detectorVersion·평균 processingMs). `ExerciseHost`가 마이크 시작(탭 안에서), rAF tick, 키(§12.3, Esc는 확인), Wake Lock, 끝나면 Attempt 저장(`detectorVersion`은 DSP 이벤트가 있을 때만, `processingMs`는 이벤트 평균).
- 단독 실행 경로 `/practice/:type?…`: 쿼리 값을 숫자·불리언·쉼표 목록·JSON으로 바꿔 기본 params 위에 덮고 플러그인 스키마로 검증. 라이브러리 "이 코드로 E1"과 E2E가 쓴다.
- 개인 선행 보정값: 같은 연습의 최근 5개 Attempt의 `meanOffsetMs` 중 3개 이상이면 평균(`personalOffset`).

## D-039 실시간 단일 테이크 선택 (`src/exercises/take.ts`)
- 벤치마크의 `selectTakeEvent`와 같은 규칙을 실시간으로: 무장(arm) 뒤 첫 판정 onset이 테이크, 400 ms 안에 다른 onset이 있으면 MULTIPLE_ONSETS. 판정 이벤트는 strum보다 ~0.4 s 늦게 오므로 모호성은 먼저 도착하는 worklet coarse onset으로 판단한다(같은 strum의 coarse onset은 정밀화 onset보다 최대 ~45 ms 늦어 60 ms 여유를 둔다).
- 무장 후 4초 동안 아무 onset도 없으면 worker의 'pluck' 구간 요청(`energyOnset` + Mode A, 벤치마크와 같은 함수)을 한 번 실행한다. 없으면 NO_ONSET 재시도.

## D-040 E1 코드 정밀 체크 흐름
- 시도: 손가락 놓기(준비됐어요/Space) → (한 줄씩) 연주하는 줄을 저음부터 차례로 Mode A, x 줄은 건너뜀(설정 "x줄 확인"이 켜져 있으면 무음 확인 `silent` 작업) → "전체를 한 번 스트럼해 들어 보고, 손을 떼었다가 다시" 단계. SPEC ④ 마지막 전체 스트럼은 귀로 듣는 단계로 두고 채점하지 않는다(한 줄씩 판정과 스트럼 베타 판정이 섞이지 않게).
- RETRY(약함·클리핑·모호·여러 번)는 같은 줄을 다시 무장하고 원인별 문구만 보여 준다. 판정된 줄은 코칭 힌트(§6.7)를 받고, FAIL 문구는 "무엇 — 어떻게"로 조합한다.
- 스트럼 베타: Mode B 결과의 `strings`는 연주하는 줄만 담고, 울린 x 줄은 `unexpected`로 온다 → x 줄 상태 UNEXPECTED. 시도 통과 = 판정 PASS.
- 귀 먼저: 앱 판정을 숨겨 두었다가 자가 판정(1/2/3) 뒤 공개, 일치율(깨끗 ↔ OK)을 시도마다 기록. 마이크가 없으면 수동 모드(1/2/3).
- 템플릿 decay 기준은 해당 줄의 개방현 템플릿을 그대로 쓴다(누른 음은 더 빨리 감쇠하므로 관대한 쪽).

## D-041 E2 1분 체인지
- 마이크가 있으면 "armed": 첫 coarse onset 시각에 타이머 시작(Space도 시작). 첫 A 스트럼은 Mode C 상태 머신 초기 상태와 같아 세지지 않는다. 시간 종료 후 'review' 단계에서 끝 이전 strum의 늦은 판정(≤ 0.6 s)도 반영하고, ↑↓ 보정과 Enter 확인을 받는다.
- `correctedChanges`는 보정 키를 한 번이라도 눌렀을 때만 기록(+1·−1 순보정 0도 "확인함"으로 기록). 탭 모드는 `detectedChanges = 0`, `tapChanges = n`. 직접 입력 모드는 review에서 ↑↓로 센 값. 마이크가 없으면 자동 → 탭.
- `changeTimestampsMs`는 시작(coarse onset) 기준 실제 ms(배율 1인 실제 앱에서는 시뮬레이션 ms와 같다).

## D-042 Mode D 연습(E5·E6·E8)의 그리드와 규칙
- 슬롯 시각 = 그리드 원점(0마디 1박) + 슬롯 × (60/BPM/박당 슬롯). 4/4는 메트로놈이 4분음표, 6/8(P5)은 BPM을 점4분 박으로 보고 메트로놈을 8분음표(×3, 1·4박 악센트)로 친다. 판정 = `analyzeTiming`(worker) + 캘리브레이션 RTT + 개인 선행 보정. 마지막 마디 뒤 0.7 s 기다렸다가 채점(판정 지연).
- E5 사다리: 적중률 ≥ 90 % & 누락 0 → +5, "지난번도 70 % 미만"(`previousLow` param, 세션 계획이 넘김)에서 다시 70 % 미만 → −5. 쉼 슬롯 strum은 extra. 시각 큐 숨김은 패턴·현재 슬롯 표시를 숨긴다(채점은 동일).
- E6: 마디 첫 박 슬롯만 기대하고 `analyzeTiming`의 hit = 창 안 마디, 평균 오프셋 = beat1 지연. "멈춤" = RTT를 뺀 strum이 [마디 시작 − 창, 다음 마디 시작 − 창)에 하나도 없는 마디. 통과 = ≥ 14/16(비율) & 멈춤 0.
- E8: 8분음표 전 슬롯 기대, `ioi_cv`는 정렬한 onset 간격으로. 통과 = 적중률 ≥ 90 % & ioi_cv ≤ 0.10.
- 마이크 없음: 1/2/3 자가 평가(1 = 놓친 박 없음 → 사다리 판단에 쓰임, `source: 'self'`).
- 공통 녹음은 상속 대신 합성(`GridRecorder`)으로 E6·E8·S가 공유한다.

## D-043 퀴즈와 연습곡
- Q1·Q3·Q4는 공통 객관식 러너(1/2/3, 반응 시간, 1.5 s 피드백 후 다음, 중단 시 남은 문제는 오답). seed 0 = 시계로 새 문제(가짜 시계 테스트는 결정적).
- Q2: 3초 카운트다운, 첫 strum을 해금 코드 전체로 Mode C set 분류, 맞고 ≤ 3 s면 통과. 6초까지 기다리고 없으면 오답(반응 시간 null). 마이크 없으면 자가 보고.
- Q3: 이름 고르기, 또는 마이크가 있으면 "이 음의 개방현 튕기기"(크로매틱 튜너 안정 판정의 음이름 비교). Q4: 공용 합성기(KS)로 근음 위치 3화음+옥타브 스트럼 재생(판정 중 재생 차단 규칙과 같은 엔진 경로).
- S: 학습 모드(멈춰도 됨, 멈춤은 횟수로 기록, 한 부분 반복)와 연주 모드(멈추지 않기, 마이크가 있으면 마디 첫 박 적중률). 끝나면 완주·멈춤 수·암기를 자가 보고. "들어 보기"는 첫 8마디를 박마다 다운 스트럼으로 합성(렌더러는 러너에 주입).

## D-044 M5 E2E 근거와 발견한 결함
- E2E fixture(E1 C 코드 줄별·2번 줄 뮤트·6번 줄 울린 스트럼, E2 A↔D 15회, E5 P3 80 BPM 8마디)는 합성기로 만들고, E2E에 쓰기 전에 같은 DSP로 오프라인 확인했다(줄별 OK/MUTED, 스트럼 FAIL·blamed [6번 줄], 체인지 14, P3 적중 48/48).
- E2E-12가 실제 결함을 찾음: `/practice/E2`에서 `/practice/E1`로 해시만 바뀌면 같은 화면 컴포넌트가 남아 E2의 저장 결과를 E1 요약으로 렌더(ZodError). 연습 호스트를 (종류 + 쿼리 + 회차) key로 다시 마운트하도록 수정.

## D-045 M5 리뷰(code-reviewer) 반영
리뷰 서브에이전트(보고만, 파일 수정 없음)의 지적을 모두 확인하고 고쳤다. 확인된 결함과 조치:
- (상) 프로덕션 번들에 `timeScale` 문자열이 남음(`practiceParams.ts`의 예약 키 집합) → 예약 집합 삭제. 모르는 키는 플러그인 zod가 버린다. 프로덕션 빌드(스크래치 폴더) 문자열 스캔에서 `timeScale`·`__gh_test` 0건 확인.
- (상) 큰 남은 시간 표시가 멈춤(러너가 사건 때만 발행) → `BaseRunner.tick`이 표시 초가 바뀔 때마다 발행(`baseRunner.test.ts`). Q2 카운트다운도 초 단위로만 발행.
- (중) 중단·미채점 실행이 0/전체 시간 결과로 저장돼 지표를 오염 → 계약에 `hasResult()` 추가: 시작 전 중단·답 0개·채점 실패면 Attempt를 저장하지 않고 "기록하지 않았어요" 안내. E2·E4는 실제 진행 시간을 기록(중단 시 타이머 정지, E2는 5초 미만 미기록). 퀴즈를 중간에 멈추면 답한 문제 수 기준.
- (중) `analyzeTiming` 실패 시 review에서 멈춤 → E5·E6·E8·S에 `.catch`(E5·E6·E8은 결과 없이 종료 + 안내, S는 첫 박 지표 없이 자가 보고 진행).
- (중) E1 한 줄에서 갇힘 → Next = 그 줄 건너뛰기(UNVERIFIABLE), x줄 확인에서 아무 소리도 없으면(fallback도 없음) OK, onset이 있었지만 판정 테이크가 안 나온 채 1초 지나면 fallback 허용. fallback 창은 캡처 링(3.9 s)에 들어가도록 3.5 s.
- (중) §12.3 첫 스트럼 자동 시작이 E5·E6·S에 없음 → 마이크가 있으면 'armed'(첫 coarse onset 또는 Space가 카운트인 시작), 없으면 'ready'. E2E-06은 Space로 시작.
- (중) 시작 버튼 연타 시 러너 2개 → `ExerciseHost` 시작 가드 + 버튼 비활성화. 저장 실패 시 다시 시도 UI.
- (중) 연습곡 학습 모드에서 "멈추고 다시" 불가 → review에서 Space = 처음부터 다시(멈춤 수 누적), Enter = 확인.
- (하) E2 종료음(액센트 클릭 2번, 판정 차단 규칙과 무관한 `output.cue`), 스트럼 베타 같은 RETRY 2회 → "한 줄씩" 유도(§10.6-6), E5 사다리 +5와 E8 통과는 8마디 이상에서만, E5 `previousLow`는 같은 패턴 최근 결과에서(`withHistory`), Q3는 마이크 선택(튜너로 개방현 튕기기 도달 가능, 문제마다 튜너 재시작), 개인 선행 보정은 E6의 beat1 지연도 사용, 목록형 쿼리 파라미터는 한 원소도 목록으로.
- 리뷰 에이전트가 레포 안에 남긴 메모리 파일(`.claude/agent-memory/…`)은 프로젝트 산출물이 아니어서 지웠다.

## D-046 M6 홈·세션 러너
- 홈과 세션 러너는 같은 저장 상태 스냅샷(`app/storedState.ts`)에서 `generateRoutine`을 돌린다(시드 = 날짜 → 같은 날 같은 루틴, §7.3-10). 별도 루틴 저장 없이 세션 시작 시 다시 계산해도 같은 목록이 나온다.
- 루틴 항목(루틴 어휘: `direction 'A>D'`, `pair 'A|D'`, `durationSec`)은 `features/session/routineParams.ts`가 플러그인 params로 바꾼다(플러그인 기본값 위에 덮고 스키마 검증). Stage 0–7 루틴 생성기가 낼 수 있는 모든 항목이 검증을 통과하는지 테스트한다.
- 세션 모델(`sessionModel.ts`, 순수): 항목 이동·건너뛰기·이전·일시정지, 연습 시간은 시계 차이(일시정지 제외), 30분마다 휴식 알림, 항목 계획 시간은 "남은 시간"으로만 보여 주고 강제하지 않는다. 복습 블록 항목은 `reviewOf = subjectKey`로 Attempt에 남는다(SRS 갱신).
- 세션 기록: 시작 시 `startSession`(계획 항목 수 = REST 제외), 끝에 자가 평가(통증 0–10, 난이도 1–5, 위험 신호, 메모)와 함께 `finishSession`(완료 = Attempt가 저장된 항목 수).
- 키보드만으로: 각 항목의 시작 버튼과 "다음 항목" 버튼에 자동 포커스, 연습 안의 키는 §12.3 매핑. E2E-07이 Stage 0 루틴 전체를 키보드로 끝낸다.
- 홈: 오늘의 루틴 카드(항목·총 시간·안내·상한 확인), 진급 체크리스트(데이터 규칙 평가 + 진행 막대, 다 채우면 진급 / 3주 정체 쌍만 남으면 조건부 진급 + 드릴 처방), 약한 쌍 Top 3(최근 3회 중앙값, 안 해 본 쌍은 뒤), 이번 주 분, 주간 스트릭, 복습 수, 백업 리마인더(마지막 백업 또는 첫 세션 후 7일).

## D-047 M6 졸업 시험·진도·라이브러리·설정·녹음 키트
- 졸업 시험(§7.6)은 항목별로 실제 연습을 이어 붙여 실행하고 규칙(`examModel.ts`)으로 판정한다: 1 = E0(마이크로 6줄 모두 ±5 cents, 수동 확인은 측정값이 없어 통과 불가), 2 = Q2 8코드(모두 3초 안 정답) + 코드별 최근 정밀 체크 깨끗 ≥ 50 %, 3 = 무작위 5쌍 각 1분(60초 전체) ≥ 30, 4 = P3 80 BPM 8마디를 시각 큐 보임·숨김 두 번 모두 ≥ 90 %, 5 = 악보 숨김 완주한 서로 다른 곡 5곡(자가 보고 지표). 매 판정은 EXAM Attempt로 남기고, 통과 시각은 `progression.exam[item]`(Stage 7 진급 규칙 `examPassed`가 읽음).
- 진도 화면: 주별 연습 분(8주), 쌍별 1분 체인지 점 + 이동 중앙값(창 3), 코드×줄 깨끗 비율 표(색 + 숫자), 패턴별 최고 통과 BPM/목표, 타이밍 평균·표준편차 추이, 복습 대기 수, 세션 목록. 차트마다 텍스트 대응물을 둔다.
- 코드 라이브러리: 스테이지별 다이어그램 격자 + 습득 단계, 상세(기대 음, 스트럼으로 확인 가능한 줄 = partial 충돌 맵, 공용 합성기 "들어 보기", E1 시작 링크).
- 설정: 테마·왼손잡이·엄격도·시각 전용·x줄 확인·세션 길이·마이크 없이, 상시 "마이크 판정은 보조 수단" 안내, 키·페달(기본 키 표 + 학습 모드: 아무 키나 눌러 동작에 연결, `customKeys`), 백업(내보내기 → `lastBackupAt` 기록, 가져오기 미리보기 → 합치기 또는 2단계 확인 바꾸기), 데이터 초기화 2단계 확인. 시작 시 `navigator.storage.persist()` 요청, 결과 표시 + iPad 홈 화면 추가 안내.
- 녹음 키트(§13.4): 캡처 링이 4초라 2초 'raw' 구간을 미리 연달아 요청해 이어 붙인다(`RawRecorder`, 샘플 연속성 테스트). 오디오는 OPFS에 16-bit WAV, 메타는 Dexie `recordings`. 내보내기는 의존성 없는 store 방식 zip(`src/data/zip.ts`, 독립 리더로 왕복 테스트) + `labels.json`(`tools/bench/real.ts`의 스키마로 검증). 메트로놈 클립은 그리드 시작(녹음 기준)과 RTT를 같이 기록.
- E2E-08은 내보내기 → 2단계 초기화 → 가져오기(미리보기 + 2단계 바꾸기) 뒤 11개 테이블 건수와 진도 화면 텍스트(세션·히트맵·패턴)가 같은지 본다.

## D-048 M7 PWA·반응형·접근성·배포 준비
- 아이콘: 하나의 도형 목록(코드 다이어그램)에서 SVG와 PNG(192·512·maskable 512·apple-touch 180)를 만든다(`tools/icons/generate.ts`, 의존성 없음: 해석적 도형 + 4×4 슈퍼샘플링 + node:zlib PNG). maskable은 내용을 80 % 안전 영역으로 축소.
- 서비스 워커는 `registerType: 'prompt'` + 앱 셸에서 등록(`app/pwa.tsx`). 새 버전은 저절로 새로고침하지 않고 **홈 화면에서만** "새 버전이 있어요" 토스트를 띄운다(연습 중 강제 새로고침 금지).
- E2E-09(오프라인)은 Chromium에서만 돈다: Playwright WebKit은 오프라인 컨텍스트에서 서비스 워커를 거치는 새로고침이 "WebKit encountered an internal error"로 실패한다(하네스 한계, 실제 Safari의 Workbox navigateFallback과 무관). SPEC §14.5에 따라 `.skip`이 아니라 `playwright.config.ts`의 WebKit 프로젝트 `testIgnore`로 뺐다.
- E2E-10: 주요 화면 18개(연습 화면은 실행 상태) × 4 뷰포트(1440×900, 1180×820, 820×1180, 390×844)에서 `scrollWidth ≤ innerWidth`, 연습 화면의 큰 버튼(min-h-16)이 64×64 px 이상, 전체 화면 스크린샷 저장(`test-results/screens/`). iPhone 메트로놈 BPM 줄이 12 px 넘쳐서 좁은 화면에서는 BPM 숫자를 윗줄로 보낸다.
- E2E-11: 같은 18개 화면 × 테마 3개(다크·라이트·고대비)에서 axe(wcag2a/aa, 21a/aa) serious·critical 0. 진도 차트는 텍스트 대응물이 있으므로 그림을 보조 기술에서 숨기고 Recharts 키보드 접근 레이어를 껐다(aria-hidden 안의 포커스 요소 위반 해결).
- 보안 헤더(`public/_headers`, `vercel.json`): `default-src 'self'` CSP(스크립트·워커·워클릿 같은 출처만, `eval`·인라인 스크립트 금지, 인라인 `style` 속성만 허용), `Permissions-Policy: microphone=(self)` 등. 실제 헤더 파일을 문서 응답에 붙인 E2E로 워클릿·DSP 워커·메트로놈 워커·차트·합성 재생이 위반 0인지 확인한다. Zod 4는 객체 파서를 `new Function`으로 컴파일하려고 시도해(기능 탐지 자체가 CSP 위반) 앱과 워커 진입점에서 `z.config({ jitless: true })`.
- 키·페달(§12.3): 기본 키 표 + 학습 모드(아무 키나 → 동작, `settings.customKeys`, 기본 키보다 우선). E2E로 학습한 키가 E2 카운트·확인에 쓰이고 Esc가 확인을 거치는지 본다.
- 문구 규칙(AC-U5)은 `src/i18n/ko.test.ts`가, 왼손잡이 미러(AC-U6)는 `src/ui/ChordDiagram.test.tsx`가, 테마 적용은 E2E-11(설정에서 테마 선택 → `html[data-theme]`)이 확인한다.

## D-049 M8 하드닝: 최종 리뷰 반영·실시간 표시·문서
- 최종 리뷰(code-reviewer, M6–M7 범위) 지적을 코드로 확인한 뒤 고쳤다:
  - (상) 통증 ≥ 5 감량(§7.3-7)이 실제 실행에 닿지 않았다. 루틴은 `item.durationSec`만 줄이는데 E2 매핑은 `params.durationSec`(60 s)를 읽었고, E1은 1분 아래를 다시 1분으로 올렸다. 항목 길이는 이제 `item.durationSec` 하나에서만 온다(루틴 params의 `durationSec` 제거). E1 블록 최솟값은 30 s다. §11.3의 "1–3분"은 평소 범위이고, 안전 규칙이 있을 때는 안전 규칙이 이긴다. 루틴 생성 → `pluginParamsFor`를 잇는 테스트를 넣었다.
  - (중상) 가져오기 "합치기"가 `progression`·`meta`를 빠뜨렸다. 그래서 새 기기에서 합치면 Stage 0으로 돌아갔다. 이제 두 테이블도 §13.3 그대로 같은 키가 없을 때만 넣는다. 이미 있는 키는 건너뛴다. 그 기기의 진도를 백업으로 덮어쓰려면 "바꾸기"를 쓴다.
  - (중) 세션 완료 항목 수가 "다음 항목"을 눌렀을 때만 셌다. 이제 Attempt가 저장되는 순간 센다(`markRecorded`). 실행 중에는 이전·건너뛰기·일시정지·종료를 막고 안내한다. 실행을 그만두려면 Esc 두 번이나 "마치기"를 쓴다. 이 버튼들이 실행을 말없이 버리던 문제다.
  - (중) 세션 러너에 §12.3 키가 없었다. 실행이 아닐 때 Space와 다음 키(PageDown, →, 학습한 페달)는 항목을 시작한다(`ExerciseHost` 대기 상태). 실행이 끝났거나 휴식 중이면 다음 항목으로 넘어간다. PageUp과 ←는 이전 항목, 일시정지 중에는 재개다. 포커스된 버튼의 Enter·Space는 버튼 자체에 맡긴다(`isNativeActivation`, 두 번 실행 방지). 마이크가 켜지는 동안 화면을 떠나면 러너를 만들지 않는다.
  - (중) 시험 항목을 중단하면(결과 null) 판정이 예외로 죽었다. 이제 `evaluateExamItem`(순수, `examModel.ts`)이 null을 불통과로 본다. 개발 모드(StrictMode)에서 항목 5가 두 번 기록되던 것도 막았다.
  - (중) 녹음 키트:
    - OPFS 지원 판정에 `createWritable`을 더했다.
    - 녹음·저장·내보내기 실패를 모두 메시지로 보여 준다.
    - 녹음 버튼 연타를 막았다.
    - 오디오 없는 기록(백업에서 가져온 메타)은 zip에서 빼고 몇 개를 뺐는지 알린다. 데이터 초기화 때 OPFS 파일도 지운다. 지우기는 최선 노력이라, 파일 시스템을 쓸 수 없어도 초기화는 끝난다(Playwright WebKit에서는 `getDirectory`가 UnknownError로 거부되어 첫 verify의 E2E-08이 실패했다).
    - 캡처 링에서 밀려난 구간이나 오지 않은 구간이 있으면(`copied` < 길이) 그 녹음을 저장하지 않는다(`IncompleteRecordingError`). 빈 구멍이 있는 fixture가 올바른 라벨을 달고 남는 것을 막기 위해서다.
  - (중하) 주간 연습 시간이 시작부터 끝까지의 벽시계 시간이었다. 이제 세션에 일시정지를 뺀 `practiceMs`를 저장하고 그 값으로 센다. 예전 세션은 시작부터 끝까지의 시간을 쓴다.
  - (하)
    - 연습 항목이 0개인 세션은 최소 체류 세션 수에 넣지 않는다.
    - 백업 실패 시 `lastBackupAt`을 되돌린다.
    - 세션 길이 입력란에서 중간 값을 쓸 수 있게 했다.
    - 진급 기준 달성 여부를 스크린 리더 텍스트로 알린다. 위험 증상 묶음에 legend를 달았다.
    - 1분 체인지 녹음 라벨에 실제 보이싱 id를 넣는다(G-2f 사용자).
    - 다른 스테이지 상세는 그 스테이지의 세션 수로 평가한다.
  - 리뷰 지적 중 바꾸지 않은 것: 졸업 시험을 Stage 7 전에도 열 수 있다. §7.6은 "항목별로 통과 기록이 남는다"고만 하고, 진급 규칙 `examPassed`는 Stage 7에서만 평가된다. 일찍 통과한 항목은 실제로 그 기준을 넘었다는 기록이다. 화면을 떠나 끝나지 않은 세션(`endedAt: null`)은 어떤 집계에도 들어가지 않으므로 그대로 둔다.
- 레벨 미터(§5.1 60 fps 시각 요소)는 React state 대신 rAF + canvas로 그린다. 수치 텍스트와 `<meter>`는 250 ms마다 ref로만 갱신한다.
- `docs/BENCHMARK.md`의 test-run log 절은 정해진 형식의 줄만 이어받는다(`parseLog`). 예전에 섞여 들어간 GuitarSet 절 조각은 다음 bench:dsp 실행에서 빠진다.
- 문서를 마무리했다: README(최종), `docs/ARCHITECTURE.md`, `docs/DSP.md` §14(실시간 경로 값), `docs/BACKLOG.md`(v2, DEFERRED 없음), `docs/MANUAL_VALIDATION.md`(실기기 체크리스트 + 결과 양식), `docs/goal/FINAL_REPORT.md`.

## D-050 verify 게이트는 추적 파일을 바꾸지 않는다(벤치 보고서는 bench-results 사본에)
- 문제: `bench:dsp`·`bench:guitarset`는 실행할 때마다 `docs/BENCHMARK.md`를 다시 쓴다(실행 시각, 성능 값, test-run log 한 줄). 그래서 M8 커밋 뒤의 최종 `npm ci && npm run verify`도 이 추적 파일을 바꾸게 된다. 그런데 §16.2-3은 최종 verify 뒤에 파일 수정과 커밋을 금지하고, §18.2·AC-P1은 `git status --short`가 비어 있기를 요구한다. 세 조건을 함께 지킬 수 없다.
- 대안:

| 대안 | 깨끗한 트리 | 최종 뒤 수정 없음 | 모든 test 실행 기록 |
|---|---|---|---|
| verify가 `docs/BENCHMARK.md`를 그대로 씀 | 아니오 | 예 | 예(커밋 안 된 변경) |
| 최종 verify 뒤 `git checkout -- docs/BENCHMARK.md` | 예 | 아니오 | 아니오(그 실행 기록이 사라짐) |
| **verify는 벤치 보고서를 `bench-results/BENCHMARK.md` 사본에 씀** | 예 | 예 | 예(게이트 실행은 사본의 log에 남음) |

- 결정: 세 번째 대안. verify는 시작할 때 `docs/BENCHMARK.md`를 `bench-results/BENCHMARK.md`로 복사한다(GuitarSet 절과 test-run log 이력이 이어진다). 그다음 벤치 단계에 `BENCHMARK_REPORT`를 넘겨 그 사본에 쓰게 한다(`tools/bench/reportPath.ts`). `npm run bench:dsp`나 `bench:guitarset`를 직접 실행하면 지금처럼 `docs/BENCHMARK.md`(기록용 보고서)를 갱신한다. 임계값 판정과 exit code는 바뀌지 않는다. 바뀌는 것은 보고서 파일 위치뿐이다.
- 커밋된 `docs/BENCHMARK.md`는 M8 커밋 직전 verify의 실행 결과다(detector 1.3.1, test split 전부 통과, GuitarSet 하드 4/4·소프트 2/2). 최종 게이트 실행의 보고서와 log는 `bench-results/BENCHMARK.md`에 있다.

## D-051 세션 결과 화면의 "다시 하기" (v1 이후 사용자 요청)
- 세션 러너에서 연습이 끝나면 "다음 항목"만 있어, 같은 항목을 바로 다시 할 수 없었다(예: E5 적중률 69 %, "55 BPM으로 내려서 다져 봐요").
- 결과 화면 버튼: `다시 하기 (Space)`와 `다음 항목 (Enter)`. 결과가 다른 템포를 제안하면 `같은 템포로 다시 (Space)`와 `N BPM으로 다시`, `다음 항목 (Enter)`을 보여 준다(사용자 선택: 버튼 두 개).
- 템포 제안은 각 연습 요약 문구와 같은 규칙이고, 플러그인 선택 훅 `suggestedTempoRetry`로 낸다. E5는 사다리 up/down이면 ±5, E6·E8은 통과하면 +5다. 같은 템포면 버튼이 없다. 코어는 연습 종류를 모른다.
- 다시 하기는 같은 항목을 새 호스트(새 key)의 시작 화면으로 연다. 자동으로 시작하지 않는다. 호스트가 바뀌면 마이크가 꺼지고, iOS는 마이크 시작이 탭·키 입력 안에서 일어나야 하기 때문이다. 시작은 Enter·Space·PageDown 한 번이다.
- 다시 한 실행도 Attempt로 쌓인다(append-only). 세션 완료 항목 수는 항목 단위라 늘지 않는다.
- 키(§12.3): 실행이 끝난 뒤 Space(toggle)는 다시 하기, Enter·PageDown·→(next)는 다음 항목이다. "다음 항목" 버튼에 포커스가 있어도 Space는 다시 하기다. 그 keydown을 먼저 처리하고, 이어지는 Space keyup을 한 번 막아 포커스된 버튼이 눌리지 않게 한다. 휴식 중에는 둘 다 다음 항목이다.


## D-052 v1.1 goal 키트 구조 (사전 결정, 2026-10-08)
- 계기: v1을 실제로 써 보니 커리큘럼과 루틴이 어긋났다(Stage 0의 자세·피크·프렛 누르기 연습 없음). 리서치↔SPEC↔구현 감사에서 34건이 나왔다(`docs/goal/v1.1/GAP_AUDIT.md`). 사용자가 A+B+C+D 전부를 v1.1로 goal 실행하기로 정했다.
- 대안:

| 대안 | 장점 | 단점 |
|---|---|---|
| v1 SPEC을 고쳐 다시 해시 고정 | 문서 하나 | v1 완료 기록(FINAL_REPORT·AC-P6)의 근거가 사라진다 |
| **v1.1 키트를 새 폴더에** | v1 기록 보존, 변경을 diff로 검토 가능 | 두 SPEC을 함께 보존·대조해야 한다 |

- 결정:
  - 두 번째 대안을 택한다. `docs/goal/v1.1/`에 자체 완결형 SPEC(v1 본문을 그대로 옮기고 고침), thresholds(v1 상위 집합), GAP_AUDIT, traceability, PROGRESS, 조건문 템플릿, render 스크립트를 둔다.
  - 해시 고정은 6개 파일이다(v1 SPEC·thresholds + v1.1 SPEC·thresholds·traceability·GAP_AUDIT).
  - 브랜치 `feat/practice-app-v1.1`은 `5e94332`에서 분기한다. 마일스톤은 M9–M15, 턴 상한은 1000이다. 결정 기록은 이 파일에 이어 쓴다.

## D-053 개방 파워코드 보이싱 4개 추가
- 리서치 Stage 10은 "R6/R5 파워코드"와 "파워코드 곡 2개"를 요구한다(01:248). 시드에는 G5·C5 두 개뿐이라 곡 두 곡을 만들 수 없다.
- 그래서 E5·A5·D5(개방)와 F5(R6 1프렛 이동형)를 더해 29개로 한다. 손가락은 E5·A5가 1·2, D5가 1·3, F5가 1·3·4이다.

## D-054 판정 중 합성 재생의 예외: 메트로놈과 반주
- v1 §8.6은 마이크 판정 중 합성 재생을 막았다. 반주(play-along, 01:109·361)를 넣으려면 예외가 필요하다.
- 사용자 결정은 "반주 중에도 전부 판정, 이어폰 권장"이다. 연주 시작 때 이어폰 확인을 받는다.
  - 스피커일 때: 반주 이벤트 시각의 onset을 템플릿으로 가린다. 코드 판정은 "참고"로만 표시하고 지표에서 뺀다. 타이밍 판정은 유지한다. `backingAudible`을 기록한다.
  - 이어폰일 때: 평소대로 판정한다.
- 대안 "반주 중 판정 안 함"은 사용자가 고르지 않았다. "스피커에서도 코드 판정을 지표로"는 오판 위험 때문에 택하지 않았다.

## D-055 지식 카드 간격 반복: 고정 사다리(FSRS 아님)
- 리서치는 둘로 나뉜다: 01:353(정답 & <3초 → 간격 확대, 오답 → 1일) 대 03:113(ts-fsrs).
- 대안:

| 대안 | 장점 | 단점 |
|---|---|---|
| ts-fsrs | 개인화된 간격 | 새 의존성, 평점 매핑을 따로 정해야 함(리서치에 없음) |
| **고정 사다리** | 리서치 01 정의 그대로, v1 SRS(1→3→7→14→30→90)와 같은 구조 | 개인화 없음 |

- 결정: 고정 사다리. 정답 & <3초 → 다음 간격, 정답 & ≥3초 → 유지, 오답 → 1일.

## D-056 정체 2주(처방)와 조건부 진급 3주의 구분
- 리서치 안에서 기간이 충돌한다(01:389 "2주 → 대체 연습 처방 또는 조건부 진급 제안", 01:288 "3주 정체 시 조건부 진급").
- 결정:
  - 2주 정체는 처방(OMC↔PFC 전환, 한 줄씩 모드, 감속)으로 이어진다.
  - 3주 정체는 조건부 진급 제안으로 이어진다.
  - 둘 다 `detectStagnation`이 매 세션 실제로 평가한다.

## D-057 초급 2 수료 = Stage 11 진급 기준 충족
- 리서치에는 초급 1 졸업 시험만 있다(01:365–372). 초급 2 시험을 새로 만들면 근거 없는 설계가 늘어난다.
- 결정: Stage 11 기준(7th 암기, 블루스 완주, Stage 11 쌍 75% ≥30)을 채우면 "초급 2 수료"로 한다. 수료 뒤에도 Stage 11 유지 루틴을 계속 만든다.

## D-058 별도 복습 슬롯 대신 같은 종류 블록 안 복습, 스테이지 시간 템플릿
- v1의 "복습 슬롯 최대 3분"은 20분 세션에서 곡 9분 보장과 충돌했다. 곡 복습(180초)은 영영 배정되지 않았고 다른 복습까지 막았다(감사 #20). 리서치 03:114의 "5분 슬롯"도 같은 이유로 들어갈 수 없다.
- 결정:
  - due 복습은 같은 종류 블록 안에서 한다(코드 → E1 칸, 쌍 → 1분 체인지 칸, 패턴 → 리듬, 곡 → 곡 블록 앞부분·레퍼토리). 밀린 항목이 뒤를 막지 않게 하고, 7일 안 배정을 시뮬레이션으로 검사한다.
  - 스테이지 시간 템플릿을 표로 고정한다(SPEC v1.1 §7.3-2, 합계 = 세션 길이).
  - 순환 블록(리듬·스케일·기술·지식)의 각 항목은 3세션마다 1회 이상 보장한다.

## D-059 베타 판정 정책
- 버징(02:223 "공개 연구 없음"), 스트럼 방향(02:275), 해머온 검출(01:342 "정확도 미검증"), 팜뮤트·셈여림(리서치에 측정법 없음)은 정답 데이터가 없다.
- 결정:
  - 모두 "베타"로 넣는다. 합성 벤치로 지표를 재서 `BENCHMARK.md` 별도 절에 보고한다.
  - `thresholds.json.beta`(목표치)는 verify 성패와 무관하다. PASS/FAIL·진급에 쓰지 않고, 화면에는 "참고(베타)"로만 보여 준다.
  - 사용자 결정은 버징·방향에 대해 "베타: 측정·보고만"이었고, 같은 근거로 나머지 셋에도 적용한다.

## D-060 v1.1 설계값 목록 (리서치에 숫자가 없어 SPEC이 정한 값)
- Stage 8–11 쌍(§6.5), 스테이지마다 곡 2곡 이상과 블루스 형식(quick change 없음), 스케일 3개의 프렛·손가락, 리프 4개, P6–P8, 스윙 기본 2:1.
- 기준 정의:
  - "대부분" = 75%(8쌍 중 6쌍)
  - 분당 환산은 실행 시간 55초 이상만
  - 곡 완주 = 멈춤 ≤2, 암기 = 숨김 단계 멈춤 ≤1, 레퍼토리 진입 = 멈춤 0
  - F 계열 = F-small·F(Fmaj7 제외)
  - Stage 8–11 체류 = 8세션 + 14일
- 연습 설정:
  - E3: 기본 60초, 깨끗한 도착은 자가 확인
  - E9: 시작 5프렛, 목표 100 BPM, "10회" = 4음 묶음 10개
  - E10: 시작 60, 졸업 80, 6단계 = 반주와 함께
  - E11: Finger Gym 절차를 고정, 상한 80
  - Q3: `strings65` = 자연음 16개
  - Q4: 인터벌 6종, 코드 진행 = 두 번째 코드가 IV·V·I 중 무엇인지
  - K1: 항목 6개
- 루틴 운영: 블록 전환 5초, 처방 만료 8세션.
- 새 임계값: `v1.1/thresholds.json`의 sequence·swing·backingBleed·solo 시퀀스 값과 beta 목표치.
- 이 값들은 앱 설정에서 조정할 수 있지만(SPEC §0-4), 테스트 계약 값은 고정이다.

## D-061 v1.1 키트 핀 전 독립 리뷰 반영 (2026-10-09)
- architect 서브에이전트 리뷰 결과는 "고정 불가"였다(Critical 6, High 14, Medium 10, Low 9). 대부분 §7.3 루틴 규칙과 §14.9 시뮬레이션 단언이 산술적으로 맞지 않거나, 결과가 실행자의 선택에 달린 문제였다. 모두 반영했다.
- 루틴(§7.3):
  - 합계 단언에 통증 감량 예외를 두고, 시뮬레이션은 `confirmedOverCap = true`로 돈다. 4주 상한은 Stage 0–7에만 적용한다. 세션 길이 설정과 고정 템플릿의 관계를 정했다.
  - K1은 배정 규칙 하나만 따른다(순환 목록에서 뺐다). Stage 0은 K1이 없는 날 E16을 240초로 하고, Stage 8–11 기술 슬롯은 120초다.
  - 1분 체인지 칸: 칸과 슬롯의 대응, 빈 슬롯 대체 규칙, 위험 쌍(5연습일), E3 규칙을 정했다. 보장 대상은 "현재 스테이지가 요구하고 아직 통과하지 않은 쌍"이다.
  - 복습: 같은 subjectKey를 복습으로 인정하고, 종류별 칸을 정했다. 지식 카드는 Q2 블록을 나눠 쓴다. 배정은 FIFO이고, 지연 상한은 max(7, ⌈q/c⌉+1)이다. Stage 8–11 E1에 복습 칸을 넣었다.
  - 순환 목록은 모두 2개 이하이고 선택 규칙 ①–④를 고정했다(3세션 보장을 모형으로 확인).
  - 암기 스케일은 TAB 숨김 배정, Stage 10 Q3는 20문항이다.
- §7.1·§6.10:
  - learn → practicedBy 표를 고정했다. K1이 "됐어요"가 된 뒤의 구간은 커버리지 단언에서 뺀다.
  - 모든 패턴에 모드 졸업과 모드 사다리를 정의했다. 모드가 적히지 않은 기준은 모드와 무관하다.
- §7.4: 정체 2주와 조건부 진급 3주의 창·최소 실행 수·비교식, minCount 규칙의 조건부 진급을 정했다.
- §11.10: 학습 → 연주 단계가 열리는 조건(끝까지 간 학습 실행 2회), 연주·숨김 단계의 코드 확인(`chordCorrectRatio`), 레퍼토리가 비었을 때의 대체를 정했다.
- §14.9: 모듈 주입, 학습자 모델 수치(쌍 첫 24/분 + 실행마다 +3 등), 창 = 7연습일, 커버리지 실행은 진급을 끄고 그 스테이지 진입 스냅샷에서 시작, 규칙 → 연습 대응표, 교착 판정식을 고정했다.
- DSP(§14.8·§14.4·§14.3):
  - sequence: 결함 주입(사이클당 1개)과 분모를 정했다. 무실수 게이트는 24음 이하 사이클에만 걸고, 불확실 비율 상한 0.05를 두었다.
  - swing: 판정기에 r을 준다. backingBleed: 패턴을 고정하고 겹침 제외·귀속 창을 정했다.
  - Stage 8–11은 근음이 겹치지 않는 고정 후보 집합으로 `modeCSetStage8to11`을 따로 판정한다.
  - GuitarSet solo: 매칭, 음높이 구간, δ, UNCLEAR 처리, 겹침, 표본 하한(1000)을 정했다. 시퀀스 경로 onset 파라미터를 따로 두어 v1 스트럼 게이트를 보호한다.
- 진행 규칙(§2·§16·§17):
  - 마일스톤과 AC 배정을 의존 순서대로 고쳤다. 무결성 9는 단계화했고(`verifySequence`는 M11부터), 부분 AC는 DOING + 범위 증거로 인정한다.
  - v1 테스트 갱신 규칙과 그 목록을 DECISIONS에 기록하도록 했다.
  - GuitarSet BLOCKED이면 AC-P10은 `DONE (G1–G3 BLOCKED)`를 허용한다.
  - 마지막 턴에는 PROGRESS를 갱신하지 않는다.
  - 축소 조건은 턴 수가 아니라 "M13 이후 같은 원인으로 verify 3회 연속 실패"다.
  - `.claude/agent-memory/`를 gitignore에 넣었다. git 조건은 `rev-parse | cut -c1-7`로 바꿨다.
- **2차 리뷰 반영**(Critical 1, High 7, Medium 5):
  - 계약 경로 전환을 M9에서 M11로 옮겼다. v1 계약 무결성 테스트가 판정 키 양방향 일치를 강제하므로, 새 영역이 구현되는 마일스톤에서 바꿔야 한다. M9에는 무결성 11(v1 ⊆ v1.1)만 넣는다.
  - 사다리 정체는 졸업했거나 목표 BPM 이상이면 판정하지 않는다. −10 처방 중인 BPM은 "현재 − 10"이다.
  - G-2f·G-3f의 쌍·기억 키는 클래스 `G`로 한다(전환 뒤에도 기록이 이어진다). G-4f·F-small만 보이싱 id 키를 쓴다.
  - 정체 창에 경과 하한을 두었다(3주 판정은 첫 실행이 14일 이상 앞, 2주 판정은 9일 이상 앞).
  - AC 배정을 의존 순서로 다시 나눴다(부분 AC 표기). 무결성 9의 `verifySequence`는 M12부터 `src/` 비테스트 호출처만 센다. 무결성 8은 M9–M11에 계획 ID를 허용한다.
  - 시퀀스 무실수·불확실 게이트는 SNR ≥ 25 층에서만 판정한다(`flawlessGateSnrDbMin`). 이 게이트를 통과하려면 음당 성공률이 99.3% 이상이어야 해서 SNR 15 층은 보고만 한다.
  - PROGRESS의 "턴 800" 문구를 지웠다. §14.9 하위 번호 참조, AC-RT3 지연 상한, withReviews 시드 구성, 축소 시 learn 표 예외, §11.6 패턴 졸업 대체 문구를 고쳤다.

## D-062 M9 기반·결함 수정: 구현 결정 (v1.1 goal 실행)
- **순서 조정**: Stage 0–4 시간 템플릿(§7.3-2)이 K1·E16·E17·Q5를 배정하므로, 이 네 연습의 플러그인 기본형을 M10이 아니라 M9에 만들었다. E17은 §10.10 판정이 들어오는 M12 전까지 사이클별 자가 보고(1 무실수 / 2 실수)로 동작한다. AC는 SPEC §16 배정 그대로다(NE1·NE2·NE6은 M10에서 마저 닫는다).
- **"마지막 등장"의 키**(§7.3 입력): 루틴에서 시작한 시도는 루틴 항목의 키(`Attempt.routineKey`, `<연습>|<subject>`)로 센다. 결과에서 읽은 키는 루틴 밖 시도와 K1(한 실행이 여러 카드를 다룸)에만 쓴다. 결과에서 읽은 키를 함께 세면 패턴 복습 실행(③)이 같은 패턴의 순환 항목 등장으로 잡혀 그 항목이 3세션 안에 다시 나오지 않았다(시뮬레이션이 찾은 결함). 순환 항목 키는 모드·시각 큐 숨김·셈여림·팜뮤트까지 구분한다(Stage 7의 P3 두 항목이 서로를 가리지 않게).
- **세션 번호·연습일**: 세션 번호는 "끝났고 기록이 1개 이상인 세션"의 순번 + 1(최소 체류와 같은 규칙), 연습일은 그런 세션이 있었던 날의 순번이다. 위험 쌍의 "5연습일"과 7일 보장은 연습일로 잰다.
- **세션 길이**: 설정에 `sessionLengthMode`(기본 `template`)를 더했다. 기본값이면 L = T(Stage 0–7 20분, 8–11 30분)이고, 사용자가 분을 직접 고치면 `custom`이 된다. v1 기본값 20분을 그대로 두면 Stage 8+에서 30분 템플릿이 늘 잘리기 때문이다. Stage 0(곡 블록 없음)의 L ≠ T 조정은 리듬 블록(늘림)과 기술 항목(뒤에서부터 뺌)으로 한다.
- **2주 정체 대상**: 통과한 쌍과 습득한 코드는 정체를 보지 않는다(처방이 필요 없는 항목에 처방을 붙이지 않게 — 보수적 선택). 코드 정체는 창 안 E1 실행(attemptId) 4회 이상, 처음 10회 대비 마지막 10회 clean 비율로 잰다.
- **처방의 루틴 배치(Stage 1–7)**: OMC→PFC 처방은 E3 연습이 생기기 전(M12)까지 기술 칸 ②에서 E4 앵커·공중 드릴로 배정한다(PG2 "E3 처방 제외"). 처방은 8세션 또는 쌍 통과로 만료, −10 BPM은 7일 또는 8세션, 한 줄씩 처방은 코드 습득 시 만료.
- **Q2**: 루틴이 후보(최대 9)를 정하고 문항 수 = max(3, 후보 수)로 모든 후보를 묻는다. 러너는 섞은 후보를 차례로 돌려 묻고(v1은 문항마다 무작위라 빠지는 코드가 생김), 문항마다 정답과 근음이 같은 다른 코드를 분류 후보에서 뺀다(§11.9).
- **곡 단계**: 완주 지표(`performCompleted`, 멈춤 ≤ 2), 암기(`hiddenMemorized`, 숨김 멈춤 ≤ 1), 레퍼토리(`repertoire`, 멈춤 0), 학습 완주(`learnFull`)를 v1 곡 결과(모드 learn/perform + chartHidden)에서 뽑는다. 결과 스키마 확장(단계·반주)은 M10/M12에서 한다.
- **분당 환산 55초**: E2 결과에서 실행 시간 ≥ 55초일 때만 `cpmQualified`를 기록하고, 진급·졸업·정체·조건부 진급은 모두 이 지표를 쓴다. 표시용 `cpm`은 그대로 둔다(복습 통과 판정도 `cpm`).
- **사다리 현재 BPM**: E5·E6·E8·E17 추출기가 `ladderBpm`(다음에 시작할 템포)을 기록하고 루틴이 그 마지막 값을 읽는다. 스킬 상태는 시도에서 언제든 다시 계산되므로 따로 저장하지 않는다.
- **루틴 편집**: 편집본은 그 단계의 사용자 템플릿 하나(`user-stage-<n>`)로 저장하고, 항목마다 템플릿 칸(JSON)을 남겨 다음 세션에 쌍·코드·템포를 다시 채운다. 편집본도 통증 감량과 첫 4주 20분 상한을 따른다.
- **시뮬레이션 주입**: `src/exercises/testing/simDeps.ts`가 실제 레지스트리·`pluginParamsFor`·플러그인 `toMetrics`·`applyAttempt`를 묶어 `simulate()`에 넘긴다. 무결성 9의 호출처 검사는 `testing/` 폴더를 프로덕션으로 세지 않는다.

## D-063 v1 테스트 갱신 목록 (SPEC v1.1 §2.4)
v1.1이 의미를 바꾼 규칙을 단언하던 v1 테스트만 v1.1 의미로 다시 썼다. 그 밖의 v1 단언은 그대로다(입력 형태만 바뀐 테스트는 고정 입력을 새 필드로 채웠을 뿐 단언을 바꾸지 않았다: `routine.test.ts` 규칙 1·4·7·8·10, `progression.test.ts` Stage 0·Stage 7·파생 쌍·G 전환, `homeModel.test.ts`, `session.test.ts`).

| 파일 | 테스트 | 근거 SPEC 절 |
|---|---|---|
| `src/domain/routine.test.ts` | rule 2 (블록 순서 → 스테이지 시간 템플릿 합계 = T) | §7.3-2 |
| 〃 | rule 3 (쌍 정렬 → 칸 1·칸 2·위험 쌍·하루 상한) | §7.3-3 |
| 〃 | rule 3 ordering (→ 쌍 하나인 스테이지의 반대 방향, 위험 쌍 중앙값 순) | §7.3-3 |
| 〃 | rule 5 (공백 복습: "chord 블록 없음" 단언 삭제 — 템플릿에 최약·복습 칸이 남음) | §7.3-2 |
| 〃 | rule 6 (3분 복습 슬롯 → 같은 종류 블록 안 복습) | §7.3-6 |
| 〃 | Stage 0 (E0·Q1·E5만 → K1·E16 포함) | §7.3-2, §7.1 |
| 〃 | conditional-promotion drills (→ 기술 칸 ② 처방, ① 항목을 밀어내지 않음) | §7.4, §7.3-6 |
| `src/domain/progression.test.ts` | Stage 1 (recall 1회 → 서로 다른 2일, 쌍 `cpm` → 55초 이상 `cpmQualified`) | §7.1 |
| 〃 | conditional promotion (21일 창·6회·14일 경과·minCount 규칙) | §7.4 |
| 〃 | promote() (`prescribedDrills` → `prescriptions`) | §7.4 |
| 〃 | stagnation (최고값 비교 → 창·실행 수·경과·종류별 기준·사다리 목표) | §7.4 |
| 〃 | graduated items (패턴 = progression 모드 연속 2연습일, 곡 = 레퍼토리 멈춤 0) | §7.1, §7.5 |
| `src/content/curriculum.test.ts` | unlock rule kinds (`recallUnlocked` → v1.1 규칙 종류) | §7.1, §7.4 |
| 〃 | focus pairs (삭제) → Stage 8–11 쌍 집합·E5 진행 코드 ≥ 2 | §7.3-3, §6.5, §6.10 |
| `src/domain/basics.test.ts` | covers every v1 exercise type (v1 목록 + v1.1 새 연습) | §11.2 |
| `src/exercises/registry.test.ts` | registers every v1 exercise once (v1 목록 + v1.1 새 연습, v1 부분집합 단언 추가) | §11.2 |
| `tests/e2e/session.mic.spec.ts` | E2E-07 항목 처리기에 K1·E16 추가(Stage 0 템플릿) | §7.3-2 |

## D-064 M10 진행 중 결정
- **졸업 시험 5번**(§7.6-5): "악보 숨김 완주"를 v1의 `hiddenCompleted`(숨김으로 끝까지, 멈춤 무관) 대신 v1.1 정의 `hiddenMemorized`(숨김 단계 완주 + 멈춤 ≤ 1, §11.10)로 센다. v1 테스트 갱신 목록에 더한다: `src/features/curriculum/examModel.test.ts` "5: songs …"(근거 §7.6-5가 가리키는 §11.10 곡 단계), `tests/e2e/exam.spec.ts` 시드 지표에 `hiddenMemorized` 추가(단언은 그대로).
- **연습 옵션 키**(§12.3 v1.1): `ear`(E), `cues`(V), `loop`(L), `hide`(H) 동작을 키 매핑에 더했다(대소문자 둘 다). E1의 M(모드 바꾸기)은 기존 `mark` 동작을 E1이 모드 순환으로 해석한다. 옵션은 실행 중에 바뀔 수 있어 러너가 `effectiveParams()`를 내고 호스트가 그 값을 Attempt params로 저장한다. E1 모드·귀 먼저는 시도 사이(손 놓기·놓기 단계)에서만 바꾼다.
- **곡 멈춤 자동 집계**: 연주·숨김 단계에서 마이크가 있으면 박 1 스트럼 적중을 마디별로 보고, 박 1이 빠진 마디가 2개 이상 이어질 때마다 멈춤 1회로 센다(사용자가 ↑↓로 고칠 수 있음).
- **같은 subject 복습 인정 = 큐 맨 앞일 때만**: "그날 어느 블록에든 due 항목과 같은 subjectKey의 실행이 배정되면 복습으로 인정"(§7.3-6)과 "종류별 FIFO"(§14.9-4)가 부딪치는 경우(뒤에 due된 항목이 다른 이유로 먼저 연습되는 날)가 있어, 같은 subject 인정은 그 종류 due 목록의 맨 앞 항목에만 적용한다. 1분 체인지 칸 1의 쌍이 큐 맨 앞이면 칸 1이 그 복습을 맡는다. 시뮬레이션(withReviews)이 FIFO 위반을 찾아 고친 것이다.
- **K1만 연결된 learn 항목의 커버리지 제외**: "됐어요가 된 뒤의 구간"을 그 창 안에서 됐어요가 된 창부터로 판정한다(창 끝 시점의 상태).
- **E6 코드 확인**: 마이크가 있으면 E6 스트럼을 Mode C 집합 분류(진행의 서로 다른 코드)로 받고, 코드가 바뀌는 마디마다 그 마디 코드 대 직전 코드 점수를 비교해 `chordCorrectRatio`를 낸다(§11.7). E6 테스트의 가짜 판정 이벤트는 러너가 설정한 작업 종류로 보내도록 고정 입력만 고쳤다(단언 그대로).
- **워커 집합 분류의 클래스**: `G-`로 시작하는 보이싱을 모두 'G'로 묶던 매핑을 `classOfVoicing`으로 바꿨다(G-4f는 따로, §6.5).
- **블록 운영(§7.3-12·13)**: 반복 대상(E5·E6·E8·E9·E10·E11·E17·Q*·S)은 실행 후 블록 시간이 남으면 "이어서 한 번 더"(사다리 다음 템포)를 첫 버튼으로 보이고 Space가 그것을 실행한다(Enter = 다음, D-051 키 그대로). 블록 시간이 다 되면 짧은 신호(액센트 클릭 2번) + "블록 끝" 표시. 블록이 바뀔 때 5초 전환 화면(Enter/Space = 바로 시작, ← = 이전), 그 5초는 블록 시간에 넣지 않는다. 설정에서 끌 수 있다.
- **튜닝 방향 그림**: 헤드 앞면 기준으로 3+3 헤드는 6·5·4번 줄 줄감개를 시계 반대 방향, 3·2·1번 줄은 시계 방향으로 돌리면 조여진다. 6 일렬 헤드는 모두 시계 반대 방향이다(설정에서 헤드 모양 선택).
- **지식 카드(§7.5)**: Q3 음 카드는 `card:note:<줄 idx>:<프렛>`, Q4 카드는 `card:ear:<종류>:<유형>`. 문항마다 정답·반응 시간을 결과 `items`에 남기고 파생 상태가 카드 간격을 갱신한다. 루틴이 due 카드를 그 퀴즈 실행에 먼저 넣고(`focus`), 그날 순환에 Q3·Q4가 없으면 Q2 블록을 Q2 30초 + 그 퀴즈 30초로 나눈다.
- **E5 새 필드**(`dynamics`, `palmMute`)와 Q3 새 필드(`scope`, `questions`, `focus`)는 선택 필드다(v1 결과·테스트와 호환).

## D-065 M10 리뷰(code-reviewer) 반영
v1.1 변경분 전체(M9 커밋 + M10 작업)를 리뷰 서브에이전트가 검토했다(critical 1, high 2, medium 6, low 3). 확인한 결함과 조치:
- (critical) **`.gitignore`의 `data/`가 `src/data/`까지 무시** → v1부터 `src/data/`(Dexie DB·마이그레이션·내보내기·repo·settings와 테스트)가 한 번도 커밋되지 않았다. 작업 트리에서는 모든 게이트가 통과해 드러나지 않았고, 깨끗한 클론은 빌드되지 않는다. 루트 전용 `/data/`로 고치고 `src/data`를 추적에 넣었다. 같은 일이 다시 생기지 않게 무결성 테스트 `tests/integrity/tracked-sources.test.ts`(src·tools·tests·public·docs 아래 git-ignore된 파일 0, 생성 오디오만 예외)를 더했다. `feat/practice-app-v1`은 규칙상 고칠 수 없어 v1.1 브랜치에서만 고친다(FINAL_REPORT 알려진 한계에 적는다). Biome도 `.gitignore`를 따라 `src/data`를 검사하지 않았었다 — 이제 검사한다.
- (high) **−10 BPM 처방이 사다리를 계속 내림**: 처방 실행의 결과가 낮은 템포로 사다리를 덮어써 다음 날 또 −10이 됐다. 처방 중 실행에 처방 시작 시점의 사다리 BPM(`ladderBase`)을 함께 넘기고, 그 실행은 사다리를 그 값 아래로 내리지 못한다(E5·E6·E8·E17 결과 `ladderBase`, 추출기 `max(ladderBase, next)`). 시뮬레이션에 사다리가 움직이지 않는 학습자 단언을 더했다.
- (high) **루틴 편집기가 오늘의 조정된 계획(통증 절반, 복습 곡, 카드 나누기)을 템플릿으로 저장** → 편집기는 통증·상한·복습·카드를 뺀 입력(`editorInput`)으로 만든 템플릿 시간 구성을 보여 준다.
- (medium) **복습·카드가 한 세션 안 반복으로 여러 단계 이동** → 복습은 due일 때만, 카드는 새 카드이거나 due일 때만 갱신한다(블록 반복·같은 코드 반복 문항).
- (medium) **L < T일 때 Stage 7+가 레퍼토리에서 빼려 함** → 줄일 때는 곡 블록(최소 300초) → 지식·기술 순환 순서, 늘릴 때만 Stage 7+ 레퍼토리.
- (medium) **실행이 끝난 뒤 옵션 키로 기록이 바뀜**(H·V) → 곡은 연주 동안 악보가 계속 숨겨져 있었을 때만 숨김(`hiddenThroughout`), H는 결과 확인 단계에서 잠근다. E5도 바가 도는 동안 큐가 계속 숨겨졌을 때만 숨김으로 기록한다(졸업 시험 4번).
- (medium) **시뮬레이션 단언 보강**: 규칙 → 연습 대응표(§14.9-3, 7연습일마다 1회 이상)를 상수로 넣고 단언, Stage 7 교착 단언을 실제 수료 사건으로, 통증일 E11·E12 제외분을 합계에서 뺀다, 사다리 제자리 학습자.
- (medium) **자가 평가 없이 나간 세션이 기록에서 빠짐** → 시도가 하나라도 있는 세션은 세션 번호·연습일·마지막 등장에 센다.
- (low) 공백 복습 알림은 실제로 지난 단계 복습 항목이 들어갔을 때만, 처방 카드의 내부 id → 표시 이름(`subjectLabel`), 휴식 알림 판단을 상태 갱신 함수 밖으로.
- 반영하지 않음: "E5 반복 실행의 `previousLow`가 오래된 값" — `ExerciseHost`가 실행을 시작할 때마다 최근 결과로 `withHistory`를 다시 적용해 `previousLow`를 새로 계산하므로 해당 없음(확인).
- 리뷰 에이전트는 레포에 파일을 만들지 않았다.
