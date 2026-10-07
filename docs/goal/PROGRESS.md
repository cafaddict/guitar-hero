# PROGRESS — guitar-hero v1 goal

> goal 실행자가 **매 턴 시작 시 읽고, 턴 끝에 갱신**한다. 컨텍스트가 압축된 뒤에는 이 파일과 SPEC.md만으로 이어갈 수 있어야 한다.
> 상태 값: TODO / DOING / DONE / BLOCKED(AC-G1·G2·G3만, SPEC §14.4 조건). DONE에는 증거(테스트 파일·테스트 이름·명령·산출물 경로)를 적는다.

## 현재 상태

- 현재 마일스톤: **M6 (커리큘럼·루틴·진도)** 시작 — M0–M5 완료
- 마일스톤 끝 리뷰 서브에이전트: M2·M5·M8 (M4는 해당 없음)
- 마지막 갱신: 2026-10-08
- 누적 턴(대략): 2
- 턴 상한: **1000** (사용자 지시, D-011). §16.1 축소는 턴 800 이후에만.
- 다음 할 일:
  2. M6: 홈(오늘의 루틴 카드·진급 체크리스트), 세션 러너(ExerciseHost 연결, 휴식 알림, 자가 평가), 커리큘럼·졸업 시험, 진도 대시보드
  3. M6: 코드 라이브러리(ChordDiagram, 들어 보기, E1 시작), 백업 UI·리마인더·persist, 녹음 키트, E2E-07/08
- 막힌 점: 없음

## 마일스톤

| M | 이름 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| M0 | 부트스트랩·스파이크 | DONE | cc0a7d6 | 스파이크 3종 통과(D-014, D-015) |
| M1 | 도메인·콘텐츠·데이터 | DONE | d37e9c1 | D-019–D-023 |
| M2 | DSP 코어·합성기·벤치마크 | DONE | 557f39d | test split 첫 실행 전 지표 통과(8,950 cases, 62 s), 리뷰 반영 D-028 |
| M3 | 실녹음 벤치마크 | DONE | 9c12306 | GuitarSet 하드 4/4·소프트 2/2(test), detector 1.3.1, test 3회 실행(D-029–D-031) |
| M4 | 오디오 엔진·캘리브레이션 | DONE | 45f5cd6 | verify PASS(750 tests, E2E 6/6), 렌더 끊김 시계 정렬 수정(D-037), D-032–D-037 |
| M5 | 연습 플러그인 | DONE | (M5 커밋) | 13종, verify PASS(1002 tests, E2E 13/13), 리뷰 반영(D-045), D-038–D-045 |
| M6 | 커리큘럼·루틴·진도 | TODO | | |
| M7 | PWA·반응형·접근성·배포 준비 | TODO | | |
| M8 | 하드닝·최종 검증 | TODO | | |

## Acceptance Criteria

| AC | 요약 | 상태 | 증거 |
|---|---|---|---|
| AC-P1 | 브랜치·커밋·main 불변·push 없음·clean | TODO | |
| AC-P2 | `npm ci && npm run verify` exit 0 | DOING | M5: `npm run verify` RESULT: PASS(8단계 전부 PASS, 1002 tests, E2E 13/13·4 projects) — 최종 `npm ci && npm run verify`는 M8 |
| AC-P3 | 라이선스 검사 통과 | DONE | `npm run licenses` (`tools/licenses.ts`): 78 prod packages 표 출력, 전부 허용. `tools/licenses.test.ts` (GPL/LGPL/AGPL/BlueOak 거부). svguitar 제거(D-013) |
| AC-P4 | 무결성 테스트 통과 | DOING | M2: `tests/integrity/source-rules.test.ts`(§14.6-1,3,4,5,6 + 패턴 자기검사), `thresholds-contract.test.ts`(§14.6-2) 전부 통과 — 최종 확인 M8 |
| AC-P5 | TS strict·noExplicitAny·린트 경고 0 | DOING | `tsconfig.base.json`(strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes), `biome.json` noExplicitAny=error, `lint` = `biome check --error-on-warnings` — 최종 확인은 M8 |
| AC-P6 | SPEC.md·thresholds.json SHA-256 일치 | TODO | |
| AC-D1 | 시드 보이싱 25개 검증 | DONE | `src/content/voicings.test.ts` — 25개 id 목록, zod `voicingSchema`, tonal 구성음 부분집합·루트·3음(파워/sus 제외), 손가락 물리 타당성(동일 손가락=동일 프렛+바레, 프렛 단조) 전부 통과 |
| AC-D2 | partial 충돌 맵·커버리지 리포트 | DONE | `src/domain/voicing.ts` `partialCollisionMap` + `DEFAULT_COLLISION_PARAMS`(§6.3 고정값 테스트), `src/domain/voicing.test.ts` "open C: 5th string verifiable, 2nd not", 커버리지 리포트 `src/domain/coverage.ts` `beginnerCoverageReport`(bench:dsp가 BENCHMARK.md에 출력 예정) |
| AC-D3 | 커리큘럼 데이터·진급 규칙 데이터화·연습곡 8곡 | DONE | `src/content/curriculum.ts`(Stage 0–7 진행, 8–11 locked), 규칙 데이터 `unlockRuleSchema`(종류만, 스테이지별 if 없음), 연습곡 10곡 `src/content/songs.ts`; `src/content/curriculum.test.ts`(스테이지 코드 제약·focus 쌍·패턴 검증) |
| AC-D4 | anchors() 테스트 | DONE | `src/domain/voicing.test.ts` "D ↔ A: finger 1 stays on the 3rd string, 2nd fret; finger 3 slides", "G ↔ C has no anchor" |
| AC-D5 | 코칭 힌트 규칙 테스트 | DONE | `src/domain/coaching.ts` + `src/domain/coaching.test.ts`(§6.7 각 행: MUTED 개방현/누르는 줄, WRONG_NOTE ±1·개방현, UNEXPECTED x줄, WEAK, 반복 실패 3회 팁 순환) + 문구 렌더 `ko.coaching.render` |
| AC-A1 | 캡처 constraint·진단·장치 오류 처리 | DONE | `src/audio/devices.ts`(constraint EC/NS/AGC false·mono·sampleRate 미지정, 오류 분류, 블루투스 라벨, getSettings 진단) + `devices.test.ts`; `src/audio/engine.ts` + `engine.test.ts`(컨텍스트→audioSession play-and-record→getUserMedia 순서, 권한 거부 PERMISSION_DENIED, 장치 없음 NO_DEVICE, 트랙 ended → DEVICE_LOST·해제·재시작, OS interrupted → 탭으로 재개, 판정 중 합성 재생 차단); 진단 저장 `meta.captureDiagnostics`(`app/services.ts`)·표시 `features/settings/DiagnosticsScreen.tsx`, 복구 UI `features/mic/MicStatusPanel.tsx`; E2E-01이 요청 constraint 확인 |
| AC-A2 | 메트로놈 스케줄러 | DONE | `src/audio/metronome.ts` + `metronome.test.ts`(가짜 시계·0–150 ms 지터·가끔 1 s 정지로 10분: 모든 클릭 그리드 오차 < 1e-9 s, 누락·중복 0, 4개 BPM; 템포 변경 다음 박부터; 카운트인 중 변경 지연; 카운트인·음소거 마디; 시각 전용; 6/8 악센트; 마디·시간 자동 정지; 탭 템포; 사다리), `metronomeRuntime.ts` + test(소리 예약·클릭 마스크 time+RTT·늦은 클릭 소리 생략·종료), Worker 타이머 `ticker/`, 화면 `features/metronome/MetronomeScreen.tsx`(rAF 시각 펄스), D-033 |
| AC-A3 | 시계 차이 타이머·Wake Lock | DONE | `src/audio/timer.ts` + `timer.test.ts`(불규칙·스로틀 1 s 틱에서 60 s 종료 오차 ≤ 1 틱 주기, 5개 시드; 일시정지 제외; 속도 배율), `src/audio/wakeLock.ts` + `wakeLock.test.ts`(획득, 숨김 후 visible에서 재획득, 해제, 미지원·거부 시 조용히 진행); 메트로놈 실행 중 Wake Lock |
| AC-A4 | 온보딩/캘리브레이션 마법사·E2E-01 | DONE | `src/features/onboarding/`(`OnboardingScreen.tsx`, `steps.tsx`, `calibrationModel.ts` + `calibrationModel.test.ts`: ±15 cents 판정, 샘플레이트 sanity, 템플릿 중앙값, loopback 2회 합의/탭 대체, 경고, Calibration 생성); 첫 실행 리다이렉트; **E2E-01** `tests/e2e/onboarding.mic.spec.ts` 통과(권한→소음→6줄 튜닝(δ = fixture 디튠 ±3 cents)→템플릿→loopback RTT 2회 측정(처음+다시 측정) 결과 모두 [120, 150] ms·차이 ≤ 3 ms, 모든 원시 시도 [120, 150] ms→IndexedDB Calibration 저장), 전체 E2E 병렬 `--repeat-each=3`·`=4` 42/42; 렌더 끊김 시계 정렬 수정 D-037; D-034, D-035, D-037 |
| AC-A5 | AudioWorklet 번들·무할당 | DONE | build: E2E(dist-e2e)에서 worklet·worker 동작; dev: `npm run check:audio-dev`(`tools/devcheck/audio-dev.ts`) PASS 3/3(TS worklet·DSP module worker·ticker worker); 무할당·성능: `src/audio/captureProcessor.test.ts`(실제 worklet 모듈, 20 s 풀 고갈 경고 0, 블록 평균 ≈ 0.04 ms ≤ 0.3 ms, 세그먼트·튜너·구간 샘플 정확), 코드: 풀 버퍼 transfer/반환·level 객체 재사용(D-032, D-036); `src/audio/dspWorker.test.ts`(zod 거부, 모든 응답 detectorVersion·processingMs, 버퍼 반환) |
| AC-S1 | Mode A 합성 지표 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: okFalseReject 0.000≤0.03, okRetry 0.0047≤0.10, wrongFalseAccept 0≤0.02, mutedFalseAccept 0≤0.05, weakFundOK 1.000≥0.95, mutedDetect 0.998≥0.80, wrongDetect 0.988≥0.90 (`src/dsp/modeA.ts`) |
| AC-S2 | Mode B 합성 지표 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: cleanFail 0.0067≤0.03, cleanRetry 0.0825≤0.15, vMutedPass 0≤0.10, vMutedFlag 0.865≥0.85, xUnexpFail 0.910≥0.85, xPass 0.080≤0.10, wrongFretPass 0≤0.10, depMisattr 0.005≤0.05; 베타 라벨은 UI(M5) (`src/dsp/modeB.ts`, D-024/D-028) |
| AC-S3 | Mode C 합성 지표 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: |err|≤1 0.983≥0.95, overcount≥2 0≤0.01, MAE 0.067≤0.6, classifySet top-1 0.998≥0.90 (`src/dsp/modeC.ts`, D-025) |
| AC-S4 | Mode D 합성 지표 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: F1@25ms 0.982≥0.95, |err| p95 12.5≤15 / median 0.88≤6 ms, sustain false 0≤0.02, click reject 1.000≥0.98, miss/extra acc 0.992≥0.95 (`src/dsp/onset.ts`, `timing.ts`) |
| AC-S5 | 튜너 지표 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: median 0.087≤1, p95 2.17≤3 cents, octave 0.001≤0.005, time-to-stable p95 125≤300 ms (`src/dsp/tuner.ts`) |
| AC-S6 | RTT 지표 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: |err| p95 0.028≤2 ms, 무신호 실패 보고 1.000 (`src/dsp/rtt.ts`) |
| AC-S7 | 성능 지표 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: verifyStrum median 9.4≤20 ms, verifyPluck 2.3≤10 ms, worklet block avg 0.018≤0.3 ms (`CaptureCore`, 무할당 — D-028) |
| AC-S8 | 커버리지·매트릭스·표본 수 | DONE | M2 verify(2026-10-08) `npm run bench:dsp` test split(시드 9000–9999) — `docs/BENCHMARK.md`, `bench-results/dsp-test.json`: coverage 0.4565 ≥ 기본 규칙 0.4565; `tests/integrity/thresholds-contract.test.ts`(매트릭스 전 값·구간 양끝 10%·최소 표본·조건별 최소(Mode B는 판정 층 안)·시드 범위·임계값 양방향 키) |
| AC-G1 | GuitarSet 파이프라인 | DONE | `tools/guitarset/download.ts`(Zenodo 3371780 API MD5 검증, curl, 3회 백오프, 실패 시 `.download-blocked` JSON 마커), `unzip.ts`(+`unzip.test.ts`), `jams.ts`(스트럼/단음/onset 정답 추출, `jams.test.ts`), `evaluate.ts`, `bench.ts`(dev 00–03 / test 04–05, `--dev-only`); 360 clips 다운로드·추출 완료 |
| AC-G2 | GuitarSet 하드 지표 | DONE | M3 verify `npm run bench:guitarset` test 플레이어(detector 1.3.1): Mode A OK 1.000(17/17)≥0.95, ±1 반음 오수용 0≤0.03, Mode C 2지선다 0.980≥0.90, 스트럼 onset F1@50ms 0.877≥0.85 — `docs/BENCHMARK.md` GuitarSet 절, `bench-results/guitarset.json` |
| AC-G3 | GuitarSet 소프트 지표 보고·분석 | DONE | 소프트(test): Mode B FAIL 0.064≤0.10, 교란 OK 0.003≤0.15 — 통과. 분석·개선 기록 `docs/DSP.md` §13(onset 재튜닝 표, Mode A 강건화), D-029–D-031 |
| AC-X1 | 플러그인 레지스트리·오디오 없는 러너 | DONE | `src/exercises/types.ts`·`baseRunner.ts`·`registry.tsx`(definePlugin 타입 지움 + zod 경계)·`catalog.ts`(13종); `src/exercises/registry.test.ts`: 13종 모두 마이크 없이 키 명령만으로 가짜 시계에서 끝까지 실행, 결과 스키마 통과, metrics = extractMetrics, 잘못된 params·남의 러너 거부; 각 러너 단위 테스트(가짜 clock + 스크립트된 판정 이벤트: `src/exercises/*/runner.test.ts`, `quiz/quiz.test.ts`, `take.test.ts`); D-038 |
| AC-X2 | E1 코드 정밀 체크·E2E-02/03/04 | DONE | `src/exercises/e1/`(한 줄씩 Mode A·x줄 건너뜀/무음 확인·RETRY 재무장·MULTIPLE·4초 무음 시 energy fallback, 스트럼 베타 Mode B, 수동 1/2/3, 귀 먼저 일치율, 코칭 힌트 "무엇 — 어떻게") + `runner.test.ts` 10개; E2E `tests/e2e/e1.mic.spec.ts`: E2E-02(5줄 OK·6번 줄 SKIPPED·Attempt 저장·detectorVersion·processingMs>0), E2E-03(2번 줄 MUTED + "2번 줄이 막혔어요 — 1번 손가락을…"), E2E-04(6번 줄 UNEXPECTED FAIL + 베타 라벨); D-039, D-040 |
| AC-X3 | E2 1분 코드 체인지·E2E-05 | DONE | `src/exercises/e2/`(armed → 첫 strum 자동 시작/Space, Mode C 상태 머신, 늦은 판정 반영, ↑↓ 보정, 자동/탭/직접 입력, detected·corrected·tap 저장) + `runner.test.ts` 7개; E2E-05 `tests/e2e/e2.mic.spec.ts`(timeScale 0.25: 자동 시작, 자동 카운트 정답 14 ±1, ↑↑↓ → corrected = detected + 1, 둘 다 저장); D-041 |
| AC-X4 | E4 앵커·공중 체인지 | DONE | `src/exercises/e4/`(`anchors(a, b)`로 앵커/공중 자동 판별, 앵커·슬라이드 안내, 1–2분 타이머 + 10회 중 동시 착지 자가 보고) + `runner.test.ts`(D→A 앵커, G→C 공중, 보고) |
| AC-X5 | E5 스트러밍 사다리·E2E-06 | DONE | `src/exercises/e5/`(P0–P5 슬롯 그리드, 6/8 메트로놈, 카운트인, Mode D + RTT + 개인 선행 보정, 쉼 슬롯 extra, 사다리 ±5, 시각 큐 숨김, 마이크 없을 때 자가 평가) + `runner.test.ts` 7개; E2E-06 `tests/e2e/e5.mic.spec.ts`(Calibration RTT 60 ms 시드, 그리드+RTT에 맞춘 fixture → 적중률 ≥ 0.9, mean/sd 표시, data-ladder=up·85 BPM); D-042 |
| AC-X6 | E6·E7·E8 | DONE | E6 `src/exercises/e6/`(마디 첫 박 Mode D, 멈춤 마디, ≥14/16 & 멈춤 0 → 통과) + test 4개; E7 `e7/`(시작 프렛, 상시 "스트레칭이지 통증 운동이 아니에요… 의학적 조언이 아닙니다", 통증 0–10) + test; E8 `e8/`(8분음표 적중률 + ioi_cv ≤ 0.10) + test 3개; 공용 `gridRecorder.ts`; D-042 |
| AC-X7 | Q1–Q4 | DONE | `src/exercises/quiz/`(공통 객관식 러너, Q1 다이어그램 점·x/o, Q2 3초 회상 Mode C set + 자가 보고, Q3 음이름/튜너로 개방현 튕기기, Q4 합성 메이저/마이너) + `quiz.test.ts` 8개; D-043 |
| AC-X8 | S 연습곡 | DONE | `src/exercises/song/`(코드 차트·현재 마디 강조, 카운트인·메트로놈, 학습/연주 모드, 부분 반복, 악보 숨김, 합성 "들어 보기", 연주 모드 마디 첫 박 적중률, 완주·멈춤·암기 자가 보고) + `runner.test.ts` 3개; D-043 |
| AC-X9 | 졸업 시험 | TODO | |
| AC-X10 | 마이크 거부 대체 흐름·E2E-12/13 | DONE | E2E-12 `tests/e2e/no-mic.mic.spec.ts`(거부 → 온보딩 안내 "마이크 없이 쓰기" → E2 탭 모드 5회 + E1 수동 1/2/3 진행·저장, detectorVersion null); E2E-13 `tests/e2e/fake-capture.spec.ts`(실제 getUserMedia 요청 EC/NS/AGC false, 진단 화면 값 = getSettings); 모든 마이크 연습의 "마이크 없이" 경로(`ExerciseHost`) |
| AC-R1 | 루틴 생성 규칙 테스트 | DONE | `src/domain/routine.ts` + `src/domain/routine.test.ts`: 규칙 1(20분·4주 상한), 2(순서·곡 마지막 9–10분), 3(쌍 우선순위·하루 6회), 4(연속 금지·interleave), 5(3일 공백 복습), 6(복습 슬롯 ≤3분), 7(통증 감량·휴식), 8(예산), 10(결정성) |
| AC-R2 | 진급 엔진 테스트 | DONE | `src/domain/progression.ts` + `src/domain/progression.test.ts`: 데이터 규칙 평가(Stage 0/1/7), 조건부 진급(3주 정체), promote 기록, 2주 정체 감지 처방, G-2f→G-3f, 졸업 항목→복습 큐 |
| AC-R3 | 복습 큐·주간 스트릭 | DONE | `src/domain/srs.ts` + `src/domain/srs.test.ts`: 1→3→7→14→30→90, 실패 시 1단계 후퇴, 곡 7→14→30→90→180→365, 주간 스트릭(주 4일+, 진행 중 주는 끊지 않음) |
| AC-R4 | 안전 규칙 | DONE | `src/domain/safety.ts` + `src/domain/safety.test.ts`: 4주 20분 상한+확인, 30분 휴식, 통증 ≥5 감량, 위험 통증 휴식일, E7 시작 프렛 하향; 문구 `ko.safety.*`(의학적 조언 아님 포함) |
| AC-R5 | 홈·세션 러너·커리큘럼·진도·E2E-07 | TODO | |
| AC-U1 | 화면 전부·i18n | TODO | |
| AC-U2 | 키·페달·첫 스트럼 자동 시작 | TODO | |
| AC-U3 | 반응형 E2E-10 | TODO | |
| AC-U4 | 접근성 E2E-11 | TODO | |
| AC-U5 | 판정 문구 규칙 | TODO | |
| AC-U6 | 테마·왼손잡이 | TODO | |
| AC-T1 | Dexie·append-only·rebuildDerived | DONE | `src/data/db.ts`(§13.2 스키마) + `src/data/repo.ts`(append-only, 수정/삭제 API 없음) + `src/data/repo.test.ts` "rebuildDerived() equals the incrementally maintained metrics, skills and reviews" |
| AC-T2 | export/import 왕복 | DONE | `src/data/exportImport.ts`(zod 봉투, 마이그레이션 골격 `MIGRATIONS`/`migrate`, 미리보기 counts, merge/replace) + `src/data/repo.test.ts` "round-trips every table into an empty database (deep-equal)", 잘못된 파일·상위 버전 거부 |
| AC-T3 | persist·백업 리마인더 | TODO | |
| AC-T4 | 녹음 키트·bench:real | TODO | |
| AC-W1 | PWA 오프라인 E2E-09 | TODO | |
| AC-W2 | 헤더·vercel.json·VITE_BASE·dev:https | TODO | |
| AC-W3 | DEPLOY.md | TODO | |
| AC-F1 | README·ARCHITECTURE·DSP·BENCHMARK·BACKLOG | TODO | |
| AC-F2 | MANUAL_VALIDATION.md | TODO | |
| AC-F3 | FINAL_REPORT.md | TODO | |

## 턴 로그 (최근 것이 위, 한 줄씩)

- 턴 1(계속): M3 완료 — GuitarSet 파이프라인, onset 재튜닝(합성+GuitarSet dev), Mode A 강건화, bench:real; GuitarSet test 하드 4/4.
- 턴 1(계속): M2 완료 — 리뷰(code-reviewer) 결함 6건 수정(D-028), test split 전 지표 통과. GuitarSet 다운로드(curl) 완료.
- 턴 1(계속): M2 — DSP 전 모듈·합성기·벤치마크 하네스·무결성 §14.6-2, dev 튜닝(D-024–D-027).
- 턴 1(계속): M1 완료 — 도메인(보이싱·충돌 맵·앵커·코칭·루틴·진급·SRS·안전), 콘텐츠(25 보이싱·커리큘럼 0–11·연습곡 10곡), Dexie 저장소·export/import·rebuildDerived. 295 tests.
- 턴 1: M0 완료 — 브랜치·docs 커밋, 스캐폴드(Vite 8/React 19/TS 7/Tailwind 4), Biome/Vitest/Playwright(4 프로젝트), verify·licenses·무결성(일부) 도구, 스파이크 3종 통과. 사용자 지시로 턴 상한 1000(D-011).
