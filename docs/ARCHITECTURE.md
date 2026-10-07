# 아키텍처 (ARCHITECTURE)

완전 초보 어쿠스틱 기타 학습용 local-first PWA. 서버가 없고, 모든 기록은 브라우저(IndexedDB, OPFS)에 남는다.
설계 결정의 근거와 이력은 [`docs/goal/DECISIONS.md`](goal/DECISIONS.md), DSP 파라미터는 [`docs/DSP.md`](DSP.md), 측정 결과는 [`docs/BENCHMARK.md`](BENCHMARK.md).

## 1. 계층

```
UI (React 19, main thread)      src/app · src/features/* · src/ui · src/i18n/ko.ts
  │  판정 이벤트(초당 수 회)만 React state로. 레벨 미터·비트 펄스는 rAF가 직접 그린다.
  ▼
연습 러너·세션·진급              src/exercises (플러그인)  src/features/session|home|curriculum
  │  ExerciseMic / ExerciseOutput 인터페이스로만 오디오를 본다(테스트는 가짜 구현)
  ▼
AudioEngine (main, 싱글턴)        src/audio/engine.ts  (+ metronomeRuntime, ticker worker)
  ├─ AudioWorklet capture-processor   src/audio/worklet  → CaptureCore(링 버퍼·레벨·onset)
  └─ DSP Worker                       src/audio/worker    → src/dsp 순수 함수 호출
  ▼
순수 모듈 (Node에서 그대로 실행)   src/dsp (신호 처리)  src/domain (음악 이론·규칙·지표)
데이터                             src/data (Dexie·저장소·내보내기/가져오기)  src/content (시드·zod 스키마)
```

- `src/dsp/**`, `src/domain/**`는 `window`·`document`·`AudioContext`·`indexedDB`·React를 쓰지 않는다. 시간은 인자로 받는다. `tests/integrity/`가 import를 스캔해 강제한다.
- 한국어 문자열은 `src/i18n/ko.ts`(와 `src/content` 시드)에만 있다. 무결성 테스트가 나머지 파일의 한글을 막는다.

## 2. 오디오 경로

```
마이크 ─ MediaStreamSource ─ capture worklet ──MessageChannel──▶ DSP worker ──▶ main(판정 이벤트)
                               │  128샘플 블록: 4 s 링, ~30 Hz 레벨, 스트리밍 spectral-flux onset
                               │  onset 구간 [−500, +400 ms] · 튜너 프레임 · 요청 구간 → 풀 버퍼 transfer
메트로놈 클릭·RTT 프로브·합성 재생 ─▶ ctx.destination
```

- **시계 하나**: worklet이 첫 블록의 `currentFrame`을 알리고, 캡처 샘플 n = 컨텍스트 프레임 `startFrame + n`. 브라우저가 렌더 블록을 건너뛰면(부하) 빈 프레임을 0으로 채워 이 정렬을 지킨다(D-037). 메트로놈 예약 시각, onset 시각, RTT, 그리드가 모두 같은 오디오 시계다.
- **판정 작업(job)**은 worker의 상태다: onsets / pluck(Mode A) / template / strum(Mode B) / pair·set(Mode C). 튜너는 따로 켜고 끈다. 구간 분석(noise, rtt, raw, pluck fallback)과 Mode D `analyzeTiming`은 id로 짝을 맞춘 요청/응답. 모든 응답에 `detectorVersion`·`processingMs`.
- 메시지는 zod 판별 유니온으로 검증한다. CSP(`script-src 'self'`)를 위해 Zod JIT는 끈다.
- **메트로놈**: Worker 안 25 ms 타이머 + 0.1 s lookahead, 앵커 기반 시각(10분 누적 오차 없음). 판정기와 클릭 시각을 공유한다(클릭 누출 마스킹, 그리드).
- **iOS**: AudioContext는 탭 안에서 만들고 재개하며, `getUserMedia` 전에 `audioSession.type = 'play-and-record'`.

## 3. 연습 플러그인

`src/exercises/types.ts`의 `ExercisePlugin<P, R, V>`: params/result zod 스키마, 순수 러너, View, Summary, `toMetrics`.
코어(호스트·세션 러너·기록·차트)는 연습 종류를 모른다. `registry.tsx`의 `definePlugin`이 제네릭을 지우고 경계에서 검증한다.

- `ExerciseRunner`: `start / command(키) / tick(rAF) / finish / hasResult / dspStats`. 마이크가 없으면 모든 러너가 수동·자가 판정으로 끝까지 간다(테스트로 보장).
- `ExerciseHost`: 마이크 시작(탭 안), 키·페달, Wake Lock, 끝나면 Attempt 저장. 아무것도 하지 않았거나 채점하지 못한 실행은 저장하지 않는다.
- 단일 테이크 선택(`take.ts`)은 벤치마크와 같은 규칙: 무장 후 첫 onset, 400 ms 안의 두 번째 onset은 MULTIPLE, 오래 조용하면 energy fallback.

## 4. 데이터

Dexie(IndexedDB) 스키마 v1: `voicings, routines, sessions, attempts, metrics, skills, progression, reviews, calibrations, recordings, meta`.

- **사실(append-only)**: Attempt(파라미터 스냅샷·결과·detectorVersion·processingMs), Session, Calibration, Recording. 수정·삭제 API가 없다(초기화만 예외).
- **캐시(재계산 가능)**: metrics·skills·reviews는 `applyAttempt`로 증분 갱신하고, `rebuildDerived()`가 Attempt 전체에서 다시 만든다(증분 = 재계산을 테스트).
- 내보내기/가져오기: JSON 봉투(zod 검증·마이그레이션 골격) → 미리보기 → 합치기 또는 2단계 확인 바꾸기. 녹음 오디오는 OPFS, 따로 zip 내보내기(`labels.json` = `bench:real` 스키마).

## 5. 커리큘럼·루틴·진급

- 커리큘럼(Stage 0–11, 8–11 잠금)과 진급 규칙은 **데이터**(`src/content/curriculum.ts`, `UnlockRule[]`)이고 `domain/progression.ts`가 평가한다(스테이지별 if문 없음).
- 오늘의 루틴은 순수·결정적 생성기(`domain/routine.ts`, 시드 = 날짜). 세션 러너는 루틴 항목을 플러그인 params로 바꿔(`features/session/routineParams.ts`) 차례로 실행한다.
- 복습 큐(간격 반복)와 주간 스트릭은 `domain/srs.ts`. 졸업 시험 5항목은 `features/curriculum/examModel.ts`.

## 6. 품질 장치

| 층 | 무엇 | 위치 |
|---|---|---|
| 단위 | 순수 모듈·러너(가짜 시계·스크립트된 판정 이벤트)·엔진(가짜 플랫폼)·worklet 모듈(Node) | `src/**/*.test.ts` |
| 합성 벤치 | 결정적 합성기 + 채널 모델, dev/test split, 임계값 판정 | `tools/bench/`, `npm run bench:dsp` |
| 실녹음 벤치 | GuitarSet(Zenodo, MD5), dev 00–03 / test 04–05 | `tools/guitarset/`, `npm run bench:guitarset` |
| 실기기 | 녹음 키트 내보내기 → `tests/fixtures/real/<기기>/` | `npm run bench:real` |
| E2E | 가짜 마이크 하네스(같은 AudioContext), 실제 getUserMedia, WebKit iPad/iPhone | `tests/e2e/`, `npm run test:e2e` |
| 무결성 | 순수성, skip/only 금지, TS 억제 금지, 한글 위치, 테스트 훅 동결, `Math.random` 금지, 임계값 계약 | `tests/integrity/` |
| 게이트 | 위 전부 + 라이선스·타입·린트·빌드 → 요약표 | `npm run verify` |

## 7. 빌드·배포

Vite 8 + React 19 + TypeScript(strict) + Tailwind 4. `vite-plugin-pwa`(prompt 업데이트), 해시 라우팅, `VITE_BASE` 하위 경로.
E2E 전용 빌드(`dist-e2e`)에만 테스트 훅(`window.__gh_test`)과 시간 압축 파라미터가 남고 프로덕션 번들에서는 dead-code 제거된다(E2E-14가 번들 문자열을 검사).
보안 헤더와 호스팅 절차는 [`docs/DEPLOY.md`](DEPLOY.md).
