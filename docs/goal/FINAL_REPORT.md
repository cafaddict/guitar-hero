# FINAL REPORT — guitar-hero v1 (완전 초보 어쿠스틱 기타 연습 웹앱)

> SPEC §18.1 구성. 브랜치 `feat/practice-app-v1`, 기준 `main` = `9e7eda6`. 작성: 2026-10-08.

## 1. 요약

1. 완전 초보 성인용 어쿠스틱 기타 연습 PWA(v1)를 만들었다. 서버 없이 local-first(IndexedDB·OPFS)로 동작하고 MacBook·iPad·iPhone 브라우저를 지원한다. 오늘의 루틴 → 세션 러너 → 자가 평가 → 진도·진급(Stage 0–7, 졸업 시험)까지 한 흐름이다.
2. 연습은 13종(E0 튜닝, E1 코드 정밀 체크, E2 1분 체인지, E4–E8, Q1–Q4, S 연습곡)이고 모두 플러그인이다. 마이크가 없거나 거부돼도 수동·자가 판정으로 끝까지 진행된다.
3. 마이크 판정기(Mode A 한 줄씩, Mode B 스트럼 베타, Mode C 코드 분류, Mode D 타이밍, 튜너, RTT)는 의존성 없는 TypeScript 순수 함수다. AudioWorklet 캡처 → DSP Worker 경로로 돈다.
4. 합성 벤치마크 test split(8,950 cases)의 모든 임계값과 GuitarSet 실녹음 test 플레이어의 하드 지표 4/4·소프트 지표 2/2를 통과했다(detector 1.3.1).
5. `npm run verify`(라이선스·타입·린트·단위 테스트·합성/실녹음 벤치·빌드·E2E 4개 프로젝트)가 PASS다. 실기기 마이크 검증은 `docs/MANUAL_VALIDATION.md`로 사용자에게 남는다.

## 2. verify 요약표 (§14.7)

마지막 M8 커밋 직전의 작업 트리(HEAD 81628a2 + D-050 변경)에서 실행한 `npm run verify` 결과다(`bench-results/verify-summary.txt`). 마지막 M8 커밋 HEAD에서 실행하는 최종 `npm ci && npm run verify` 결과는 마지막 출력(§18.2)에 있다.

```
VERIFY SUMMARY (guitar-hero @ 81628a2)
step              status    time
licenses          PASS      0s     (49 prod packages, all allowed)
typecheck         PASS      1s
lint              PASS      0s
test              PASS      2s     (1131/1131 tests)
bench:dsp         PASS      1m24s  (all thresholds met)
bench:guitarset   PASS      24s    (hard 4/4, soft 2/2)
build             PASS      2s
test:e2e          PASS      1m29s  (35/35 tests, 4 projects)
RESULT: PASS
```

- M8 중 verify는 세 번 돌았다.
  - 첫 번째는 `test:e2e` 33/35로 실패했다. 데이터 초기화에 넣은 OPFS 파일 삭제가 Playwright WebKit에서 `getDirectory` 거부로 E2E-08을 멈췄다. 삭제를 최선 노력으로 바꿨다(D-049).
  - 두 번째는 PASS였다(1125 tests, E2E 35/35).
  - 세 번째가 위 표다. 그 사이 verify가 벤치 보고서를 `bench-results/BENCHMARK.md` 사본에 쓰도록 바꿨다. 최종 verify 뒤에도 작업 트리가 깨끗해야 하기 때문이다(D-050).

## 3. 지표표

### 3.1 합성 벤치마크 (`npm run bench:dsp`, test split)

아래 표는 커밋된 기록용 보고서 `docs/BENCHMARK.md`(M8 두 번째 verify의 실행)에서 옮겼다. 그 뒤 게이트 실행의 값은 `bench-results/BENCHMARK.md`에 있다. 판정기 코드가 같으므로 성능(perf) 행의 ms 값만 실행마다 조금씩 다르다.

- 실행: 2026-10-07T20:13:07.863Z · split **test** · detectorVersion **1.3.1** · 8950 cases · 101 s

| 영역 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| modeA | okFalseRejectMax | 0.0000 | 0.0300 | PASS | 429 |
| modeA | okRetryMax | 0.0000 | 0.1000 | PASS | 429 |
| modeA | wrongNoteFalseAcceptMax | 0.0000 | 0.0200 | PASS | 1716 |
| modeA | mutedFalseAcceptMax | 0.0070 | 0.0500 | PASS | 429 |
| modeA | weakFundamentalOkMin | 1.000 | 0.9500 | PASS | 429 |
| modeA | mutedDetectRateMin | 0.9930 | 0.8000 | PASS | 429 |
| modeA | wrongNoteDetectRateMin | 0.9948 | 0.9000 | PASS | 1716 |
| modeB | cleanFailMax | 0.0067 | 0.0300 | PASS | 600 |
| modeB | cleanRetryMax | 0.0825 | 0.1500 | PASS | 400 |
| modeB | verifiableMutedPassMax | 0.0000 | 0.1000 | PASS | 400 |
| modeB | verifiableMutedCorrectFlagMin | 0.8700 | 0.8500 | PASS | 400 |
| modeB | xStringRingingUnexpectedFailMin | 0.9125 | 0.8500 | PASS | 400 |
| modeB | xStringRingingPassMax | 0.0775 | 0.1000 | PASS | 400 |
| modeB | wrongFretVerifiablePassMax | 0.0000 | 0.1000 | PASS | 400 |
| modeB | dependentMutedMisattributionMax | 0.0050 | 0.0500 | PASS | 400 |
| modeC | absErrLe1RateMin | 0.9917 | 0.9500 | PASS | 120 |
| modeC | overcountGe2RateMax | 0.0000 | 0.0100 | PASS | 120 |
| modeC | meanAbsErrMax | 0.0500 | 0.6000 | PASS | 120 |
| modeCSet | top1AccuracyMin | 0.9970 | 0.9000 | PASS | 1000 |
| modeD | onsetF1At25msMin | 0.9926 | 0.9500 | PASS | 3772 |
| modeD | timingAbsErrP95MsMax | 9.161 | 15.000 | PASS | 3772 |
| modeD | timingAbsErrMedianMsMax | 0.8750 | 6.000 | PASS | 3772 |
| modeD | sustainFalseOnsetRateMax | 0.0050 | 0.0200 | PASS | 400 |
| modeD | clickBleedRejectRateMin | 0.9851 | 0.9800 | PASS | 134 |
| modeD | patternMissExtraAccuracyMin | 0.9955 | 0.9500 | PASS | 5152 |
| tuner | medianAbsCentsMax | 0.0873 | 1.000 | PASS | 1000 |
| tuner | p95AbsCentsMax | 2.170 | 3.000 | PASS | 1000 |
| tuner | octaveErrorRateMax | 0.0010 | 0.0050 | PASS | 1000 |
| tuner | timeToStableMsP95Max | 125.3 | 300.0 | PASS | 1000 |
| rtt | absErrP95MsMax | 0.0278 | 2.000 | PASS | 200 |
| rtt | silentFailureReportRateMin | 1.000 | 1.000 | PASS | 60 |
| perf | verifyStrumMedianMsMax | 9.541 | 20.000 | PASS | 1 |
| perf | verifyPluckMedianMsMax | 2.279 | 10.000 | PASS | 1 |
| perf | workletBlockAvgMsMax | 0.0364 | 0.3000 | PASS | 1 |
| coverage | modeBVerifiableRatioAtLeastDefaultRule | 0.4565 | 0.4565 | PASS | 9 |

스트럼 모드 검증 가능 줄 커버리지(Stage 0–7 보이싱 전체): **0.457**(보이싱별 표는 `docs/BENCHMARK.md`).

### 3.2 GuitarSet 실녹음 (`npm run bench:guitarset`)

- 실행: 2026-10-07T20:13:33.632Z · detector **1.3.1** · 360 clips · 데이터: Zenodo 3371780 (GuitarSet 1.1.0, **CC BY 4.0**, Xi et al. 2018) — `audio_mono-mic` + `annotation`

**test 플레이어(04, 05) — 판정**

| 구분 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| **하드** | modeAOkRateMin | 1.0000 | 0.9500 | PASS | 17 |
| **하드** | modeAPerturbedFalseAcceptMax | 0.0000 | 0.0300 | PASS | 17 |
| **하드** | modeCPairAccuracyMin | 0.9799 | 0.9000 | PASS | 299 |
| **하드** | strumOnsetF1At50msMin | 0.8771 | 0.8500 | PASS | 4996 |
| 소프트 | modeBFalseRejectMax | 0.0641 | 0.1000 | PASS | 312 |
| 소프트 | modeBPerturbedFalseAcceptMax | 0.0033 | 0.1500 | PASS | 306 |

**dev 플레이어(00–03) — 튜닝용, 참고**

| 구분 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| **하드** | modeAOkRateMin | 1.0000 | 0.9500 | PASS | 39 |
| **하드** | modeAPerturbedFalseAcceptMax | 0.0000 | 0.0300 | PASS | 39 |
| **하드** | modeCPairAccuracyMin | 0.9802 | 0.9000 | PASS | 555 |
| **하드** | strumOnsetF1At50msMin | 0.8521 | 0.8500 | PASS | 10014 |
| 소프트 | modeBFalseRejectMax | 0.0376 | 0.1000 | PASS | 585 |
| 소프트 | modeBPerturbedFalseAcceptMax | 0.0000 | 0.1500 | PASS | 582 |

## 4. AC 표 (PROGRESS.md와 같음)

| AC | 요약 | 상태 | 증거 |
|---|---|---|---|
| AC-P1 | 브랜치·커밋·main 불변·push 없음·clean | DONE | `feat/practice-app-v1`에 M0–M8 커밋(`git log --oneline main..HEAD`), `git rev-parse --short main` = 9e7eda6(불변), `git remote -v` 비어 있음·`git branch -vv`에 upstream 없음, M8 커밋 후 `git status --short` 비어 있음 — 최종 확인 출력은 §18.2 |
| AC-P2 | `npm ci && npm run verify` exit 0 | DONE | 마지막 M8 커밋 직전 `npm run verify` RESULT: PASS(§14.7 8단계 전부 PASS, 1131 tests, E2E 35/35·4 projects, `bench-results/verify-summary.txt`, `docs/goal/FINAL_REPORT.md` §2); HEAD에서 `npm ci && npm run verify` 최종 실행 결과는 §18.2 출력 |
| AC-P3 | 라이선스 검사 통과 | DONE | `npm run licenses` (`tools/licenses.ts`): prod packages 표 출력(M8 verify: 49 packages), 전부 허용. `tools/licenses.test.ts` (GPL/LGPL/AGPL/BlueOak 거부). svguitar 제거(D-013) |
| AC-P4 | 무결성 테스트 통과 | DONE | `tests/integrity/source-rules.test.ts`(§14.6-1,3,4,5,6 + 패턴 자기검사), `thresholds-contract.test.ts`(§14.6-2) — M8 verify의 test 단계에서 전부 통과 |
| AC-P5 | TS strict·noExplicitAny·린트 경고 0 | DONE | `tsconfig.base.json`(strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes), `biome.json` noExplicitAny=error, `lint` = `biome check --error-on-warnings` — M8 verify typecheck·lint 단계 PASS |
| AC-P6 | SPEC.md·thresholds.json SHA-256 일치 | DONE | `shasum -a 256`: SPEC.md `3f7c3ffd1f32ef3251f2960c3d992383d63578a1c2454b83baec152ade4da597`, thresholds.json `a318e01bb7fe8dee690d73192bcd4170976ab513112d96a907d2430a9d4f8e81` = goal 조건문 값(두 파일 커밋 이후 수정 없음) — §18.2 출력 |
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
| AC-X9 | 졸업 시험 | DONE | `src/features/curriculum/examModel.ts` + `examModel.test.ts`(5항목 규칙: ±5 cents, 8코드 3초 + 깨끗 50 %, 무작위 5쌍 ≥30, P3 80 BPM 보임·숨김 ≥90 %, 악보 숨김 5곡), `ExamScreen.tsx`(항목별 연습 연결 실행, EXAM Attempt 기록, `progression.exam` 통과 보존); E2E `tests/e2e/exam.spec.ts`(미통과 기록 → 조건 충족 후 통과·새로고침 후 유지, 3 projects); D-047 |
| AC-X10 | 마이크 거부 대체 흐름·E2E-12/13 | DONE | E2E-12 `tests/e2e/no-mic.mic.spec.ts`(거부 → 온보딩 안내 "마이크 없이 쓰기" → E2 탭 모드 5회 + E1 수동 1/2/3 진행·저장, detectorVersion null); E2E-13 `tests/e2e/fake-capture.spec.ts`(실제 getUserMedia 요청 EC/NS/AGC false, 진단 화면 값 = getSettings); 모든 마이크 연습의 "마이크 없이" 경로(`ExerciseHost`) |
| AC-R1 | 루틴 생성 규칙 테스트 | DONE | `src/domain/routine.ts` + `src/domain/routine.test.ts`: 규칙 1(20분·4주 상한), 2(순서·곡 마지막 9–10분), 3(쌍 우선순위·하루 6회), 4(연속 금지·interleave), 5(3일 공백 복습), 6(복습 슬롯 ≤3분), 7(통증 감량·휴식), 8(예산), 10(결정성) |
| AC-R2 | 진급 엔진 테스트 | DONE | `src/domain/progression.ts` + `src/domain/progression.test.ts`: 데이터 규칙 평가(Stage 0/1/7), 조건부 진급(3주 정체), promote 기록, 2주 정체 감지 처방, G-2f→G-3f, 졸업 항목→복습 큐 |
| AC-R3 | 복습 큐·주간 스트릭 | DONE | `src/domain/srs.ts` + `src/domain/srs.test.ts`: 1→3→7→14→30→90, 실패 시 1단계 후퇴, 곡 7→14→30→90→180→365, 주간 스트릭(주 4일+, 진행 중 주는 끊지 않음) |
| AC-R4 | 안전 규칙 | DONE | `src/domain/safety.ts` + `src/domain/safety.test.ts`: 4주 20분 상한+확인, 30분 휴식, 통증 ≥5 감량, 위험 통증 휴식일, E7 시작 프렛 하향; 문구 `ko.safety.*`(의학적 조언 아님 포함) |
| AC-R5 | 홈·세션 러너·커리큘럼·진도·E2E-07 | DONE | 홈 `features/home/HomeScreen.tsx` + `homeModel.ts`(+test: 같은 날 같은 루틴, 주간 분·오늘·백업 리마인더, 약한 쌍, 체크리스트), 세션 `features/session/SessionScreen.tsx` + `sessionModel.ts`·`routineParams.ts`(+test: 이동·일시정지·휴식 알림, Stage 0–7 모든 루틴 항목 → 플러그인 params 검증), 커리큘럼 `features/curriculum/CurriculumScreen.tsx`(0–11, 8–11 잠금 미리보기, 상세 + 기준 진행), 진도 `features/progress/ProgressScreen.tsx` + `progressModel.ts`(+test); **E2E-07** `tests/e2e/session.mic.spec.ts`(마이크 없이 Stage 0 루틴 6항목을 키보드만으로 → 세션 1·Attempt N·자가 평가 저장·홈 "오늘 연습" 갱신); D-046 |
| AC-U1 | 화면 전부·i18n | DONE | §12.1 화면: 홈, 세션 러너, 연습(`/practice/:type`), 커리큘럼(+상세·졸업 시험), 코드 라이브러리(+상세: 기대 음·확인 가능 줄·들어 보기·E1), 튜너, 메트로놈, 진도, 설정(장치·캘리브레이션·테마·왼손잡이·엄격도·시각 전용·키·페달 학습·백업·녹음 키트·진단(getSettings·RTT·sampleRate·detectorVersion)·초기화 2단계); 모든 한국어 문자열 `src/i18n/ko.ts`(무결성 테스트 `tests/integrity/source-rules.test.ts` "no Hangul outside comments" 전 파일 통과) |
| AC-U2 | 키·페달·첫 스트럼 자동 시작 | DONE | `src/app/keys.ts` + `keys.test.ts`(§12.3 전체 매핑, 학습 키 우선, 입력란 제외), 설정 키·페달 학습 모드(`SettingsScreen.tsx` KeysSection), E2E `tests/e2e/keys.spec.ts`(학습한 "b"로 E2 카운트·확인, Esc 확인 대화상자, 3 projects); 첫 스트럼 자동 시작: E2(E2E-05), E5·E6·S armed(러너 테스트, D-045); 세션 러너 실행 사이 키(PageDown/→ 시작·다음 항목, PageUp/← 이전, 실행 중 이동 잠금) `sessionModel.sessionKeyCommand` + `session.test.ts`, `keys.test.ts` `isNativeActivation`, E2E `tests/e2e/keys.spec.ts` "page-turner keys walk the session…"(3 projects), D-049 |
| AC-U3 | 반응형 E2E-10 | DONE | `tests/e2e/layout.spec.ts`: 주요 화면 18개 × 4 뷰포트(1440×900, 1180×820, 820×1180, 390×844) 가로 스크롤 0, 연습 화면 주요 버튼 ≥ 64×64 px, 스크린샷 `test-results/screens/<project>/` — 3 projects 통과; D-048 |
| AC-U4 | 접근성 E2E-11·aria-live | DONE | `tests/e2e/a11y.spec.ts`: 18개 화면 × 다크·라이트·고대비 axe serious/critical 0(3 projects); 판정 결과 `aria-live="polite"` 영역(E1·E2·E5·Q·온보딩), 색 + 아이콘·텍스트 병행, 다이어그램 텍스트 설명(`ChordDiagram.test.tsx`), 진도 차트 텍스트 대응물 |
| AC-U5 | 판정 문구 규칙 테스트 | DONE | `src/i18n/ko.test.ts`: FAIL = 무엇 + 어떻게(모든 힌트 조합), RETRY 원인별 서로 다른 문구 7종, "틀렸습니다" 없음, "내 귀가 먼저" 안내(온보딩·설정); E2E-03 실제 화면 문구 |
| AC-U6 | 테마·왼손잡이 미러 | DONE | 테마 토큰 `src/app/styles.css`(다크 기본·라이트·고대비), 설정에서 선택 → `html[data-theme]`(E2E-11이 세 테마 모두 적용·검사), 왼손잡이 미러 `src/ui/ChordDiagram.tsx` + `ChordDiagram.test.tsx`(6번 줄 좌↔우) |
| AC-T1 | Dexie·append-only·rebuildDerived | DONE | `src/data/db.ts`(§13.2 스키마) + `src/data/repo.ts`(append-only, 수정/삭제 API 없음) + `src/data/repo.test.ts` "rebuildDerived() equals the incrementally maintained metrics, skills and reviews" |
| AC-T2 | export/import 왕복 | DONE | `src/data/exportImport.ts`(zod 봉투, 마이그레이션 골격 `MIGRATIONS`/`migrate`, 미리보기 counts, merge/replace) + `src/data/repo.test.ts` "round-trips every table into an empty database (deep-equal)", 잘못된 파일·상위 버전 거부 |
| AC-T3 | persist·7일 백업 리마인더 | DONE | `src/app/persist.ts`(시작 시 `navigator.storage.persist()`, 설정에 결과 표시), 리마인더 `homeModel.backupReminderDue`(+test: 마지막 백업/첫 세션 후 7일) → 홈 배너, 내보내기 시 `meta.lastBackupAt`; E2E-08 `tests/e2e/backup.spec.ts`(내보내기→초기화→가져오기 후 11개 테이블 건수·진도 화면 동일, 3 projects) |
| AC-T4 | 녹음 키트·bench:real | DONE | `src/features/recording/`(안내 순서 클립: 코드별 깨끗한 스트럼·한 줄씩·일부러 뮤트·x줄 울림, 30초 체인지+직접 센 수, 메트로놈 8마디+그리드 시작·RTT; `RawRecorder` 2초 구간 연결(+test: 연속성·길이), OPFS 16-bit WAV, Dexie 메타), `labels.json` = `tools/bench/real.ts` `labelsSchema`(+test), zip `src/data/zip.ts`(+test: 독립 리더 왕복·CRC32); `npm run bench:real`(파일 없으면 "no fixtures"로 성공, M3); D-047 |
| AC-W1 | PWA 오프라인 E2E-09·prompt | DONE | `vite.config.ts` VitePWA `registerType: 'prompt'`(앱 셸·시드·아이콘 precache), `src/app/pwa.tsx`(홈에서만 업데이트 토스트), 아이콘 `tools/icons/generate.ts` → `public/`; **E2E-09** `tests/e2e/offline.spec.ts`(설치 후 오프라인 새로고침 → 앱 셸·코드 라이브러리·상세 동작, Chromium — WebKit 하네스 한계 D-048) |
| AC-W2 | `_headers`·`vercel.json`·`VITE_BASE`·`dev:https` | DONE | `public/_headers`, `vercel.json`(같은 헤더, E2E가 동일성 확인), CSP 실동작 E2E `tests/e2e/csp.mic.spec.ts`(워클릿·DSP 워커·티커 워커·차트·합성 재생 위반 0, Zod jitless), `VITE_BASE`(`vite.config.ts` base), `npm run dev:https`(basicSsl) |
| AC-W3 | `docs/DEPLOY.md` | DONE | `docs/DEPLOY.md`: Cloudflare Pages·Netlify·Vercel·GitHub Pages 단계, HTTPS가 필요한 이유, iPad/iPhone 홈 화면 추가, `dev:https` LAN 테스트(자체 서명 경고 통과), 업데이트 방식 |
| AC-F1 | README·ARCHITECTURE·DSP·BENCHMARK·BACKLOG | DONE | `README.md`(소개·요구 사항·스크립트·iPad에서 쓰는 법·데이터와 백업·아키텍처 요약), `docs/ARCHITECTURE.md`(계층·오디오 경로·플러그인·데이터·커리큘럼·품질 장치·빌드), `docs/DSP.md`(§1–13 판정기 파라미터와 근거·튜닝 기록, §14 실시간 경로 값), `docs/BENCHMARK.md`(`bench:dsp`·`bench:guitarset` 생성), `docs/BACKLOG.md`(v2, DEFERRED 없음) |
| AC-F2 | MANUAL_VALIDATION.md | DONE | `docs/MANUAL_VALIDATION.md`: 기기(MacBook Chrome·Safari, iPad Safari 홈 화면 앱, iPhone Safari), 캘리브레이션, 튜너 vs 다른 튜너, E1 일부러 뮤트·다른 음·x줄, E2 자동 vs 직접 센 값, E5 스트럼 타이밍(소리·시각 전용), 녹음 키트 → `bench:real`, PWA·Wake Lock·페달·백업, 결과 기록 양식 |
| AC-F3 | FINAL_REPORT.md | DONE | `docs/goal/FINAL_REPORT.md`(§18.1 1–8절: 요약, verify 요약표, 합성·GuitarSet 지표표, AC 표, 마일스톤 커밋, 결정 요약, 알려진 한계, 다음 할 일) |

## 5. 마일스톤 커밋 (`git log --oneline main..HEAD`)

```
1482c94 M7: PWA, responsive layout, accessibility and deploy readiness
130edec M6: home, session runner, curriculum, exam, progress, library, settings
f911cd5 M5: exercise plugins (E0–E8, Q1–Q4, S) with live judging
45f5cd6 M4: audio engine, metronome, timer and calibration wizard
9c12306 M3: GuitarSet real-recording benchmark and real-fixture harness
557f39d M2: DSP core, synthesizer and synthetic benchmark
d37e9c1 M1: domain model, content seeds and local data layer
cc0a7d6 M0: bootstrap scaffold, quality tooling and audio spikes
9432bcd wip(M0): import research and goal docs
```

이 보고서를 담은 두 번째 M8 커밋(`M8: verify gate leaves the work tree clean`, D-050)이 위 목록 맨 위에 더해진다. 최종 목록은 §18.2 출력에 있다.

## 6. 주요 결정 요약

전체 기록: [`docs/goal/DECISIONS.md`](DECISIONS.md) (D-001–D-049).

- **판정 철학**(D-007): 인식이 아니라 기대한 코드·음의 검증이다. 결과는 PASS / RETRY / FAIL 3상태이고, 확신이 없으면 RETRY로 다시 치게 한다.
- **스택**(D-008, D-012, D-013): Vite 8 + React 19 + TS strict + Tailwind 4, Dexie, Zustand, Zod 4, Recharts, vite-plugin-pwa. GPL/AGPL 의존성은 없다(svguitar 제거, 다이어그램은 자체 SVG).
- **오디오 경로**(D-014, D-032–D-037): 캡처는 AudioWorklet(링 4 s, 무할당), 판정은 DSP Worker, 시계는 하나(캡처 샘플 n = 컨텍스트 프레임 startFrame + n)다. 렌더 블록이 빠지면 0으로 채워 시간 정렬을 지킨다(D-037).
- **판정기 튜닝**(D-024–D-031): 파라미터는 dev split(합성 시드·GuitarSet 00–03)으로만 맞췄다. test split은 판정에만 썼다. onset 재튜닝과 Mode A 강건화는 `docs/DSP.md` §13에 있다.
- **플러그인 계약**(D-038): params/result zod 스키마, 순수 러너, View로 구성한다. 코어는 연습 종류를 모른다. 모든 러너는 가짜 시계와 스크립트된 판정 이벤트로 테스트한다.
- **세션·진급**(D-022, D-046, D-047): 루틴은 날짜 시드로 결정적이다. 진급 규칙은 데이터로 두고, 졸업 시험은 항목별 EXAM Attempt로 기록한다.
- **배포·보안**(D-048): prompt 방식 서비스 워커(연습 중 강제 새로고침 없음), CSP `script-src 'self'`(Zod jitless), `_headers`와 `vercel.json`의 동일성을 E2E로 확인한다.
- **최종 하드닝**(D-049): 통증 감량이 실제 실행 길이에 닿게 했다. 백업 합치기에 진도·설정을 넣었다. 세션 완료 수를 저장 시점에 센다. 페달로 세션 전체를 진행할 수 있다. 녹음 키트는 실패 처리와 구멍 난 녹음 거부를 갖췄다. 주간 시간은 일시정지를 뺀 연습 시간이다.

## 7. 알려진 한계

- **마이크 차이**: 판정기는 합성음과 GuitarSet(스튜디오 콘덴서, 근접, 조용한 방)으로만 검증했다. 휴대폰·태블릿 내장 마이크, 방 울림, 오래된 줄에서의 성능은 아직 측정하지 않았다. `bench:real`(녹음 키트 fixture)이 그 측정 수단이고 지금은 fixture가 없다("no fixtures").
- **스트럼 모드(Mode B, 베타)의 확인 불가 줄**: 같은 음이나 배음이 겹치는 줄은 한 번 긁은 소리로 가릴 수 없다. Stage 0–7 보이싱 전체에서 확인 가능한 줄 비율은 0.457이다. 확인 불가 줄은 "확인 불가"로 표시하고 판정에 넣지 않는다. 정확한 확인은 한 줄씩 모드(Mode A)다.
- **iOS 재생 품질**: iOS에서 마이크를 켠 동안 재생 품질이 떨어진다(WebKit bug 311451). 그래서 메트로놈 클릭은 단순 합성음이다. 반주 재생과 판정을 함께 쓸 때는 유선 헤드폰을 권한다. 블루투스 출력은 지연이 커서 RTT를 탭 보정으로 받는다.
- **GuitarSet 스트럼 onset 여유**: test F1@50ms는 0.877이지만 dev는 0.852로 임계값 0.85에 바짝 붙어 있다. 녹음 조건이 더 나쁘면 첫 스트럼 자동 시작과 타이밍 판정이 흔들릴 수 있다.
- **오프라인 E2E는 Chromium만**: Playwright WebKit은 오프라인 상태에서 서비스 워커를 거친 새로고침이 하네스 내부 오류로 실패한다(D-048). iPad 홈 화면 앱의 오프라인 동작은 실기기 체크리스트로 확인해야 한다.
- **Safari 저장소**: `storage.persist()`를 요청하지만 Safari는 오래 쓰지 않은 사이트 데이터를 지울 수 있다. 백업 JSON 내보내기(7일 리마인더)와 홈 화면 추가가 대응책이다. 녹음 키트 오디오(OPFS)는 백업 JSON에 들어가지 않는다. 녹음 키트는 `createWritable`을 지원하는 브라우저에서만 열린다.
- **판정은 보조 수단**: 버징(fret buzz)·스트럼 방향은 판정하지 않는다(v2, `docs/BACKLOG.md`). 마이크 판정과 내 귀가 다르면 내 귀가 먼저다(앱 안내 문구).

## 8. 사용자가 다음에 할 일

1. **실기기 검증**: [`docs/MANUAL_VALIDATION.md`](../MANUAL_VALIDATION.md) 순서대로 진행한다(MacBook Chrome/Safari, iPad 홈 화면 앱, iPhone, 기기당 30–40분). 순서는 캘리브레이션 → 튜너 비교 → E1 일부러 뮤트 → E2 자동 vs 직접 센 값 → E5 타이밍 → PWA·Wake Lock·페달이고, 결과는 양식에 적는다.
2. **녹음 키트 → `bench:real`**: 설정 > 녹음 키트에서 안내된 클립을 녹음하고 zip으로 내보낸다. `tests/fixtures/real/<기기>/`에 풀어 `npm run bench:real`을 실행한다. 계속 어긋나는 판정은 BACKLOG의 재조정 항목으로 넘긴다.
3. **배포**: [`docs/DEPLOY.md`](../DEPLOY.md)대로 HTTPS 정적 호스팅(Cloudflare Pages·Netlify·Vercel·GitHub Pages)에 `dist/`를 올린다. 보안 헤더는 `public/_headers` 또는 `vercel.json`에 있다. 그다음 iPad Safari에서 "홈 화면에 추가"를 한다.
4. **`main` 병합 여부 결정**: 작업은 `feat/practice-app-v1` 브랜치에만 커밋되어 있다(push·병합 없음). 실기기 검증 결과를 보고 `main`에 병합할지 정한다.
