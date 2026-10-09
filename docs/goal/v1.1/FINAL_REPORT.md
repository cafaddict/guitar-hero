# FINAL REPORT — guitar-hero v1.1 (초급 1 + 초급 2)

> SPEC v1.1 §18.1 구성. 표 2–4·6은 최종 `npm run verify`와 `PROGRESS.md`·`git log`에서 그대로 옮겼다. 명세 [`SPEC.md`](SPEC.md), 진행 [`PROGRESS.md`](PROGRESS.md), 결정 [`../DECISIONS.md`](../DECISIONS.md).

## 1. 요약

1. v1(Stage 0–7)에 이어 **Stage 8–11과 초급 2 수료**까지 실제로 진행되는 기타 연습 PWA다. 루틴은 스테이지 템플릿(20분 / Stage 8+ 30분, 2×15 분할)을 쌍 슬롯·순환 3세션 보장·처방·복습·레퍼토리 규칙으로 채우고, 진급은 데이터로 정의된 규칙으로 평가한다.
2. 새 연습 E3·E9·E10·E11·E12·E16·E17·K1·Q5와 Q3·Q4 확장, 곡 연주 단계 **반주(play-along)**(이어폰이면 그대로 판정, 스피커면 반주 누출을 가려 박 1을 판정하고 코드 확인은 "참고")를 넣었다.
3. 새 하드 판정은 **단음 시퀀스 검증**(§10.10)과 **반주 누출 마스킹**(§10.12)이다. 합성 test split의 v1·v1.1 하드 지표가 모두 임계값을 만족하고, GuitarSet 실녹음 하드 6/6(solo 시퀀스 2개 포함)·소프트 3/3을 통과한다. 버징·방향·레가토·팜뮤트·셈여림은 베타로 재고 보고만 한다.
4. 리서치 추적표 215항목 중 202개 구현·13개 제외(근거 있음)·0개 연기. v1의 "배울 것이 연습으로 이어지지 않는" 결함은 learn 항목 연결(무결성 8)과 Stage 0–11 커리큘럼 시뮬레이션(§14.9)으로 다시 막았다.
5. M9–M15 각 마일스톤은 verify 통과 후 커밋했고, 마일스톤 끝 리뷰(M10·M12·M15)의 지적은 D-065·D-068·D-071로 반영했다.

## 2. verify 요약표 (§14.7)

M15 변경을 모두 담은 작업 트리에서 실행한 결과(헤더의 해시는 실행 시점의 부모 커밋). 커밋 뒤 HEAD에서 다시 실행한 `npm ci && npm run verify` 결과는 마지막 보고 메시지(§18.2)에 그대로 붙인다.

```
VERIFY SUMMARY (guitar-hero @ ae357c1)
step              status    time
licenses          PASS      0s     (49 prod packages, all allowed)
typecheck         PASS      1s
lint              PASS      0s
test              PASS      3s     (1663/1663 tests)
bench:dsp         PASS      3m48s  (all thresholds met; beta reported)
bench:guitarset   PASS      39s    (hard 6/6, soft 3/3)
build             PASS      2s
test:e2e          PASS      5m06s  (53/53 tests, 4 projects)
RESULT: PASS
```

## 3. 벤치마크

### 3.1 합성 벤치마크 — test split (v1 영역 + v1.1 영역)

- 실행: 2026-10-09T03:53:25.795Z · split **test** · detectorVersion **1.4.0** · 14406 cases · 228 s

| 영역 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| modeA | okFalseRejectMax | 0.0000 | 0.0300 | PASS | 429 |
| modeA | okRetryMax | 0.0000 | 0.1000 | PASS | 429 |
| modeA | wrongNoteFalseAcceptMax | 0.0000 | 0.0200 | PASS | 1716 |
| modeA | mutedFalseAcceptMax | 0.0023 | 0.0500 | PASS | 429 |
| modeA | weakFundamentalOkMin | 1.000 | 0.9500 | PASS | 429 |
| modeA | mutedDetectRateMin | 0.9953 | 0.8000 | PASS | 429 |
| modeA | wrongNoteDetectRateMin | 0.9936 | 0.9000 | PASS | 1716 |
| modeB | cleanFailMax | 0.0100 | 0.0300 | PASS | 600 |
| modeB | cleanRetryMax | 0.0625 | 0.1500 | PASS | 400 |
| modeB | verifiableMutedPassMax | 0.0025 | 0.1000 | PASS | 400 |
| modeB | verifiableMutedCorrectFlagMin | 0.9025 | 0.8500 | PASS | 400 |
| modeB | xStringRingingUnexpectedFailMin | 0.9250 | 0.8500 | PASS | 400 |
| modeB | xStringRingingPassMax | 0.0625 | 0.1000 | PASS | 400 |
| modeB | wrongFretVerifiablePassMax | 0.0050 | 0.1000 | PASS | 400 |
| modeB | dependentMutedMisattributionMax | 0.0100 | 0.0500 | PASS | 400 |
| modeC | absErrLe1RateMin | 1.000 | 0.9500 | PASS | 120 |
| modeC | overcountGe2RateMax | 0.0000 | 0.0100 | PASS | 120 |
| modeC | meanAbsErrMax | 0.0000 | 0.6000 | PASS | 120 |
| modeCSet | top1AccuracyMin | 0.9970 | 0.9000 | PASS | 1000 |
| modeD | onsetF1At25msMin | 0.9911 | 0.9500 | PASS | 3772 |
| modeD | timingAbsErrP95MsMax | 8.277 | 15.000 | PASS | 3771 |
| modeD | timingAbsErrMedianMsMax | 0.8163 | 6.000 | PASS | 3771 |
| modeD | sustainFalseOnsetRateMax | 0.0075 | 0.0200 | PASS | 400 |
| modeD | clickBleedRejectRateMin | 0.9851 | 0.9800 | PASS | 134 |
| modeD | patternMissExtraAccuracyMin | 0.9963 | 0.9500 | PASS | 5152 |
| tuner | medianAbsCentsMax | 0.0873 | 1.000 | PASS | 1000 |
| tuner | p95AbsCentsMax | 2.170 | 3.000 | PASS | 1000 |
| tuner | octaveErrorRateMax | 0.0010 | 0.0050 | PASS | 1000 |
| tuner | timeToStableMsP95Max | 125.3 | 300.0 | PASS | 1000 |
| rtt | absErrP95MsMax | 0.0278 | 2.000 | PASS | 200 |
| rtt | silentFailureReportRateMin | 1.000 | 1.000 | PASS | 60 |
| sequence | noteOnsetF1At30msMin | 0.9994 | 0.9500 | PASS | 5027 |
| sequence | cleanNoteOkRateMin | 0.9978 | 0.9700 | PASS | 5027 |
| sequence | wrongNoteDetectRateMin | 1.000 | 0.9000 | PASS | 480 |
| sequence | missedDetectRateMin | 1.000 | 0.9000 | PASS | 240 |
| sequence | extraDetectRateMin | 0.9875 | 0.8500 | PASS | 240 |
| sequence | faultyCycleFlawlessRateMax | 0.0021 | 0.0200 | PASS | 960 |
| sequence | cleanCycleFlawlessRateMin | 1.000 | 0.9000 | PASS | 136 |
| sequence | cleanCycleUncertainRateMax | 0.0000 | 0.0500 | PASS | 157 |
| modeCSetStage8to11 | top1AccuracyMin | 0.9990 | 0.9000 | PASS | 1000 |
| swing | onsetF1At25msMin | 0.9924 | 0.9500 | PASS | 3008 |
| swing | timingAbsErrP95MsMax | 9.229 | 15.000 | PASS | 3008 |
| swing | slotAssignmentAccuracyMin | 0.9714 | 0.9500 | PASS | 3008 |
| backingBleed | strumOnsetF1At25msMin | 0.9863 | 0.9000 | PASS | 2672 |
| backingBleed | backingHitFalseStrumRateMax | 0.0049 | 0.0500 | PASS | 2022 |
| perf | verifyStrumMedianMsMax | 9.331 | 20.000 | PASS | 1 |
| perf | verifyPluckMedianMsMax | 2.267 | 10.000 | PASS | 1 |
| perf | workletBlockAvgMsMax | 0.0363 | 0.3000 | PASS | 1 |
| coverage | modeBVerifiableRatioAtLeastDefaultRule | 0.4565 | 0.4565 | PASS | 9 |

### 3.2 베타 보고 — 게이트 아님 (목표치 대비)

| 지표 | 값 | 목표 | 목표 충족 | n |
|---|---|---|---|---|
| buzzDetectRateMin | 0.6200 | 0.7000 | 아니오 | 500 |
| buzzFalseAlarmRateMax | 0.1080 | 0.1000 | 아니오 | 500 |
| directionAccuracyMin | 0.5500 | 0.8500 | 아니오 | 500 |
| legatoOnsetRecallMin | 0.9920 | 0.7000 | 예 | 500 |
| legatoFalseOnsetRateMax | 0.0000 | 0.1000 | 예 | 500 |
| palmMuteAccuracyMin | 0.9990 | 0.8000 | 예 | 1000 |
| dynamicsAccuracyMin | 1.000 | 0.8500 | 예 | 500 |
| modeCUnderBleedAbsErrLe1RateMin | 0.7333 | 0.8500 | 아니오 | 120 |

### 3.3 GuitarSet 실녹음 — test 플레이어(04, 05)

- 실행: 2026-10-09T03:54:04.434Z · detector **1.4.0** · 360 clips · 데이터: Zenodo 3371780 (GuitarSet 1.1.0, **CC BY 4.0**, Xi et al. 2018) — `audio_mono-mic` + `annotation`

| 구분 | 지표 | 값 | 임계값 | 판정 | n |
|---|---|---|---|---|---|
| **하드** | modeAOkRateMin | 1.0000 | 0.9500 | PASS | 17 |
| **하드** | modeAPerturbedFalseAcceptMax | 0.0000 | 0.0300 | PASS | 17 |
| **하드** | modeCPairAccuracyMin | 0.9799 | 0.9000 | PASS | 299 |
| **하드** | strumOnsetF1At50msMin | 0.8771 | 0.8500 | PASS | 4996 |
| **하드** | soloSequencePitchOkRateMin | 0.9868 | 0.9500 | PASS | 2654 |
| **하드** | soloSequencePerturbedFalseAcceptMax | 0.0004 | 0.0300 | PASS | 2654 |
| 소프트 | modeBFalseRejectMax | 0.0641 | 0.1000 | PASS | 312 |
| 소프트 | modeBPerturbedFalseAcceptMax | 0.0033 | 0.1500 | PASS | 306 |
| 소프트 | soloSequenceOnsetF1At50msMin | 0.8101 | 0.7500 | PASS | 4625 |

## 4. AC 표 (`PROGRESS.md`와 같음)

| AC | 요약 | 상태 | 증거 |
|---|---|---|---|
| AC-P7 | `feat/practice-app-v1.1`에 키트 커밋 이후 M9–M15 커밋 존재, `main`은 `9e7eda6`, `feat/practice-app-v1`은 `5e94332` 그대로, 원격 push 없음(upstream 없음), 작업 트리 clean. | DONE | `git log --oneline 5e94332..HEAD`: 키트 `012fb70` 뒤 M9 `13cbca7`·M10 `197db37`·M11 `b4db85d`·M12 `b08b6bb`·M13 `e1e1a87`·M14 `ae357c1`·M15 커밋; `main` = `9e7eda6`, `feat/practice-app-v1` = `5e94332`(수정·병합 없음), push·원격 추가 없음(upstream 없음), 최종 `git status --short` 비어 있음 — 마지막 메시지 §18.2-1 출력 |
| AC-P8 | v1 `SPEC.md`·`thresholds.json`과 v1.1 `SPEC.md`·`thresholds.json`·`traceability.json`·`GAP_AUDIT.md`의 SHA-256이 goal 조건문의 값과 같다. | DONE | `shasum -a 256` 6개 파일이 goal 조건문 값과 같음(3f7c3ffd…·a318e01b…·4b6d4b00…·ff4dbbac…·5764c271…·c60d89ee…); 키트 커밋 이후 이 파일들을 바꾼 커밋 0 — §18.2-2 출력 |
| AC-P9 | `npm ci && npm run verify` exit 0, §14.7 형식 요약표(v1.1 계약 기준). | DONE | HEAD에서 `npm ci && npm run verify` exit 0, §14.7 요약표 전 단계 PASS(licenses·typecheck·lint·test·bench:dsp·bench:guitarset·build·test:e2e) — `docs/goal/v1.1/FINAL_REPORT.md` 2절, §18.2-3 출력 |
| AC-P10 | v1 AC(P1–P6, D1–D5, A1–A5, S1–S8, G1–G3, X1–X10, R1–R5, U1–U6, T1–T4, W1–W3, F1–F3) 보존 | DONE | v1 단위·E2E·벤치가 매 마일스톤 verify(M9–M15)에서 통과, v1 임계값 ⊆ v1.1 계약(무결성 11), v1 Mode D 패턴·v1 GuitarSet 4지표 유지(strum F1 0.877). v1 테스트 갱신은 SPEC 근거가 있는 확장만: D-063·D-064·D-066·D-067·D-069·D-070 목록. v1의 `src/data` 미추적 결함은 v1.1에서만 고침(D-065, FINAL_REPORT 알려진 한계) |
| AC-TR1 | `traceability.json` 완전성 무결성 테스트 통과, FINAL_REPORT에 항목별 대조 결과(구현·제외·연기 수). | DONE | `tests/integrity/traceability.test.ts`(215항목, 상태·SPEC 절·AC ID·제외 근거) 통과; FINAL_REPORT 5절: 구현 202 · 제외 13 · 연기 0과 제외 목록 |
| AC-TR2 | 모든 learn 항목의 `practicedBy` 유효(무결성 8) + 커버리지 단언 Stage 0–11 통과. | DONE | 무결성 8 `tests/integrity/learn-table.test.ts`; 커버리지 `src/domain/simulate.test.ts` "every learn item is practised at least twice in every 7 practice days…" Stage 0–11(improving 28일), pain 0–11, blank 0–1, plateau 3 |
| AC-TR3 | 진급 규칙 ↔ 루틴 대응과 도달 단언 통과, 교착 0. | DONE | `simulate.test.ts` "every unlock rule is fed by its exercise…"(규칙 → 연습 대응표 상수, Stage 0–11, 곡 = 연주 단계), 도달 "the improving learner promotes through every stage to Beginner 1 and Beginner 2 without a deadlock"(스테이지마다 최소 체류 + 20연습일, 교착 0, 139일째 초급 2 수료), plateau 조건부 진급 22연습일, pain 감량 |
| AC-TR4 | SPEC 요구 함수 프로덕션 호출 검사(무결성 9) 통과. | DONE | `tests/integrity/production-calls.test.ts` 8개(M9–M11 7개 + M12 `verifySequence`, 호출처 `src/audio/worker/dsp-worker.ts` 구간 요청 `sequence`) |
| AC-RT1 | 스테이지 시간 템플릿 합계·배치 테스트, Stage 8–11 30분과 분할, 레퍼토리 블록. | DONE | `v11Records.test.ts` "every template sums to T…"(0–11), `simulate.test.ts` "Σ block time = the template length T…"(0–7 1200 s, 8–11 1800 s, 통증일 공식), 분할 `src/features/session/session.test.ts` "SPEC v1.1 §7.3-11 split sessions" + E2E-18 `tests/e2e/split.mic.spec.ts`(레퍼토리 블록이 앞, 분할 → 이어서 하기 → 한 세션), 레퍼토리 `simulate.test.ts` "Stage 7+: every session has a repertoire block" |
| AC-RT2 | 쌍 슬롯 배정과 7일 배정 보장, 순환 블록 3세션 보장, 처방 추가·만료(기술 항목을 몰아내지 않음). | DONE | Stage 0–7: `src/domain/simulate.test.ts` "every rotation entry appears…"·"required, unpassed pairs…"(Stage 0–7×improving, blank 0–1, pain), "plateau learner…"(처방 추가·② 배치·8세션 만료·순환 유지); `routine.test.ts` rule 3 두 개. 남음: E3 처방(M12), Stage 8–11(M13). M12: OMC→PFC·PFC→OMC 처방 배치 `routine.test.ts` "SPEC v1.1 §7.4 PFC ↔ OMC prescriptions at Stage 8"(D-067). Stage 8–11: 같은 단언이 0–11 커버리지에서 통과(M13) |
| AC-RT3 | 복습 배정(같은 종류 블록, 밀림 방지, 7일 안 배정), 지식 카드 간격 반복. | DONE | `simulate.test.ts` "withReviews learner, Stage 5 (AC-RT3)…"(30개 동시 due FIFO·지연 ≤ max(7,⌈q/c⌉+1)), `routine.test.ts` "rule 6 (v1.1 §7.3-6)…"·"rule 6 (cards)…"·"SPEC v1.1 §7.5 scale and riff review drafts", `v11Records.test.ts` 카드 사다리·"a due review moves one step per due date"·"scale and riff reviews (M12 code review)", `quiz/cards.test.ts`; 복습 실행이 사다리를 되돌리지 않음 `e10/runner.test.ts` "next run…" |
| AC-RT4 | 블록 시간 반복·끝 신호·전환 화면. | DONE | `session.test.ts` "SPEC v1.1 §7.3-12·13 block time…"(전환 화면 조건, 전환 시간은 블록 시간 밖), SessionScreen 블록 끝 신호(액센트 클릭 2번 + "블록 끝")·"이어서 한 번 더"(사다리 다음 템포, Space), E2E-07·E2E-15가 전환 화면을 거쳐 끝까지 진행 |
| AC-RT5 | 파라미터 의미: progression 코드 진행, 사다리 현재 BPM, E7 시작 프렛, 통증 감량 실행 반영. | DONE | `simulate.test.ts` 커버리지 "parameters: progression mode carries ≥ 2 chords; tempos follow the ladder; E7 follows the stretch records"(0–11), "§14.9-6 parameters, Stage 7–11"(E9·E10·E11 사다리 템포, Stage 9 c-major-open 3번째 배정부터 TAB 숨김, Stage 10 Q3 strings65 20문항, Stage 7+ 레퍼토리), "pain learner…"(E1·E2·E3 실행 길이 절반, E11·E12 제외) |
| AC-PG1 | Stage 0–11 규칙 데이터와 새 규칙 종류 단위 테스트, Stage 7 → 8 진급, 초급 2 수료. | DONE | 규칙 데이터 `curriculum.test.ts` "defines stages 0–11, all playable…"·"expresses unlock rules as data…", 새 규칙 종류 `progression.test.ts`(scaleStepGraduated·scaleMemorized·quizRunAtLeast·chordCleanRatioAtLeast·songs 필터), Stage 7 → 8·초급 2 수료 "promote(): … Stage 7 → 8 completes Beginner 1, Stage 11 Beginner 2", 도달 시뮬레이션, E2E-19 `tests/e2e/beginner2.spec.ts`(chromium·iPad·iPhone) |
| AC-PG2 | 정체 감지 연결과 처방 표, 조건부 진급 3주, 2주/3주 구분 테스트. | DONE | `src/domain/sessionPrep.test.ts`(세션 시작 detectStagnation → 처방, 만료), `progression.test.ts` "stagnation (v1.1 §7.4)"·"conditional promotion (v1.1 §7.4)", `simulate.test.ts` plateau(22연습일 안 조건부 진급). 남음: PFC↔OMC E3 처방(M12). M12: OMC→PFC(Stage 8–11 E3 칸)·PFC→OMC(E3 칸에서 빼고 E2 칸 2) `routine.test.ts` "SPEC v1.1 §7.4 PFC ↔ OMC prescriptions at Stage 8" |
| AC-PG3 | G 보이싱 3단 전환 제안(`suggestedGVoicing` 연결), E7 시작 프렛 조정(`nextStretchStartFret` 연결). | DONE | `sessionPrep.test.ts` "AC-PG3: suggests the three-finger G…"(G-2f→G-3f Stage 6, G-3f→G-4f Stage 8), `simulate.test.ts` "G voicing: the switch…"(수락 후 E1 G-3f)·"E7 start fret…"(5,5,5,4,4,4,3…), `v11Records.test.ts` "E7 start fret from the records", 홈 추천 카드(HomeScreen `g-switch`), 무결성 9 호출 검사 |
| AC-CT1 | 보이싱 29개 검증, 스케일 3개 검증, 리프 4개와 TAB 렌더, 패턴 P6–P8과 스윙 그리드, Stage 8–11 쌍, 연습곡 18곡+ 스테이지 코드 제약과 블루스 형식. | DONE | 보이싱 29개 `src/content/voicings.test.ts`, 스케일 3개 `src/content/scales.test.ts`, 리프 4개 `src/content/riffs.test.ts`·TAB 렌더 `src/ui/Tab.test.tsx`, P6–P8·스윙 그리드 `src/dsp/synth/v11.test.ts`·`e5/runner.test.ts` "swing patterns (§6.10)…", Stage 8–11 쌍 `curriculum.test.ts` "pairs and E5 progressions…", 18곡+·코드 제약·블루스 `curriculum.test.ts` "SPEC v1.1 §6.6: ≥ 18 songs…" |
| AC-NE1 | K1 자가 체크 카드와 루틴 배정 규칙. | DONE | K1 플러그인·`k1/runner.test.ts`, 배정 규칙 `routine.test.ts` "Stage 0 (v1.1)…", E2E-15 K1 카드 저장. Stage 0·2 완료. 남음: Stage 8·10 항목(M13). M13: Stage 8·10 항목 `simulate.test.ts` "Stage 8 and 10 self-check cards (K1) are assigned in the first three sessions…" |
| AC-NE2 | E16 프렛 위치 비교, E2E-15. | DONE | `e16/runner.test.ts`(Mode A 세 위치·자가 판정), E2E-15 `tests/e2e/stage0.mic.spec.ts` 두 개(키보드 Stage 0 세션 저장; fixture ① OK ③ MUTED, detectorVersion·processingMs) |
| AC-NE3 | E3 정확 빠른 체인지, 통과·졸업·안내. | DONE | `src/exercises/e3/runner.test.ts`(마이크: 체인지 카운터 도착·Enter/↓ 표시·표시 안 함 = 아님, 무마이크: pass = 깨끗 ≥ 0.8 & ≥ 20/분), 졸업 `progression.test.ts` "SPEC v1.1 §11.11: an E3 pair graduates…", 안내·Mode B 베타 표시 `src/exercises/e3/plugin.tsx` |
| AC-NE4 | E9 크로매틱, E10 스케일 사다리 1–5단계·사다리·암기, E12 새끼손가락, E2E-16. | DONE | E9 `src/exercises/e9/runner.test.ts`, E10 `src/exercises/e10/runner.test.ts`(마이크 청크 판정·졸업, 틀린 음 위치·반음, 자가 보고·암기, H, 반주 스피커 = 참고, 다음 실행·복습), E12 `src/exercises/e12/runner.test.ts`, E2E-16 `tests/e2e/e10.mic.spec.ts` |
| AC-NE5 | E11 해머온, 하루 상한, 레가토 베타 표시. | DONE | `src/exercises/e11/runner.test.ts`(해머온 슬롯 = 레가토 베타, 하루 상한·사다리, 다음 실행), 루틴 상한 `routine.test.ts` "E11 carries today's minutes…", 레가토 베타 표시 `e11/plugin.tsx` `e11-legato`("참고·베타") |
| AC-NE6 | E17 리프, Q5 TAB 퀴즈. | DONE | E17 자가 보고 경로 `e17/runner.test.ts`(사다리 4회 연속·−5 규칙, H 키), Q5 `quiz/cards.test.ts` "Q5 TAB reading…", TAB 렌더 `ui/Tab.tsx`. 남음: E17 §10.10 마이크 판정·R3·R4(M12). M12: E17 마이크 판정(§10.10) `e17/runner.test.ts` "with a microphone (§10.10): R3…", R3·R4 데이터 `src/content/riffs.test.ts` |
| AC-NE7 | Q3 범위 확장, Q4 종류 확장, E2E-21. | DONE | `src/exercises/quiz/quiz.test.ts` "SPEC v1.1 §11.15 Q3 ranges and §11.21 Q4 kinds"(범위 3종·4지선다·카드, 인터벌 6지·진행 3지·소리), E2E-21 `tests/e2e/q3.mic.spec.ts` |
| AC-NE8 | S 곡 단계(학습·연주·숨김)·완주·암기·레퍼토리 정의. | DONE | 곡 단계·완주·암기·레퍼토리 지표 `v11Records.test.ts` "song stages…", 멈춤 자동 집계·키 `song/v11.test.ts`, 루틴 곡 블록 단계 `simulate.test.ts`(Stage 2 연주 완주로 진급), 졸업 시험 5번 `examModel.test.ts`. 남음: 반주·코드 확인(M12), 레퍼토리 블록 곡 순환(M13). M12: 반주·코드 확인 `src/exercises/song/backing.test.ts`(이어폰/스피커/키), E2E-17. 남음: 레퍼토리 블록 곡 순환(M13). M13: 레퍼토리 블록 곡 순환 `routine.test.ts` "SPEC v1.1 §11.10 repertoire block: \"차례로 친다\"", 세션 "이어서 한 번 더" = 다음 레퍼토리 곡 |
| AC-NE9 | E5 v1.1 추가(P6–P8, 모드 사다리, 보정 hit_rate 기준, 박 세기·발 박자 안내, 시각 큐 숨김 키, 셈여림 모드, 팜뮤트 옵션), E6 Stage 1·사다리·코드 확인, E8 사다리 저장. | DONE | E5: V 키·박 번호·셈여림 자가 평가·보정 hit_rate 사다리 `e5/v11.test.ts`; E6 Stage 1(템플릿)·사다리 `ladderBpm`·코드 확인 `e6/runner.test.ts` "chordCorrectRatio…"; E8 사다리 저장 `v11Records.test.ts`. 남음: P6–P8·스윙·팜뮤트 옵션(M12). M12: P6–P8·스윙 `e5/runner.test.ts` "swing patterns (§6.10)…", 팜뮤트 옵션 "palm-mute option (§11.6, §10.11)…" |
| AC-EX1 | E0·온보딩 튜닝 방향 안내와 건너뛰기, E1 경향 요약·모드 키, E7 안내 문구. | DONE | `tuningGuide.test.ts`(조이기/풀기·줄감개 방향), `ui/TuningDirection.tsx`(온보딩·E0·튜너), `calibrationModel.test.ts` "AC-EX1 (v1.1 §9.3): strings skipped…", E1 경향 `e1/tendency.test.ts`, 모드 키 E2E-22, E7 안내 문구 `ko.exercises.e7.how` |
| AC-SQ1 | §14.8 sequence 지표 전부 통과(합성 test split). | DONE | `npm run bench:dsp`(test, detector 1.4.0): sequence 8/8 — note onset F1 0.9994, clean 음 OK 0.9978, 틀린 음 1.000, MISSED 1.000, EXTRA 0.9875, 결함 사이클 무실수 오판 0.0021, clean 무실수 1.000(n 136), 불확실 0.000. 구현 `src/dsp/sequence.ts`, 단위 `src/dsp/sequence.test.ts`, 계약 커버리지 `tests/integrity/thresholds-contract.test.ts` "sequence: …"(3개) |
| AC-SQ2 | GuitarSet solo 시퀀스 하드 지표 통과, 소프트 지표 보고(미달 시 개선 시도·원인 분석을 `docs/DSP.md`에). | DONE | `npm run bench:guitarset`(test 04–05): soloSequencePitchOkRate 0.9868(n 2654 ≥ 1000), 교란 오수용 0.0004 — 하드 2/2, 소프트 onset F1 0.8101 ≥ 0.75. 개선 기록 `docs/DSP.md` 15·19절(clarity 선택·기준, dev 0.912 → 0.973), D-066 |
| AC-SW1 | §14.8 swing 지표 통과. | DONE | `bench:dsp` test: swing F1 0.9924, |오차| p95 9.23 ms, 슬롯 배정 0.9714. 스윙 그리드 `patternSlotTimes`(`src/dsp/synth/v11.test.ts` "swing slots…"), `analyzeTiming.strumSlots`(`src/dsp/backingMask.test.ts` "§14.8 swing slot assignment"), 계약 "swing: …" |
| AC-BK1 | §14.8 backingBleed 지표 통과 + 반주 정책 + E2E-17. | DONE | M11 DSP 부분 완료: `bench:dsp` test backingBleed F1 0.9863, 반주 오검출 0.0049. 마스킹 `src/dsp/backingMask.ts`(+ `onset.ts` `PickOptions.backing`), 반주 합성 `src/dsp/synth/backing.ts`, 단위 `src/dsp/backingMask.test.ts`(−10/−18/−25 dB), 계약 상수 대조 "backing bleed: …". 남음: 반주 재생·이어폰 정책·E2E-17(M12). M12: 반주 정책 `src/exercises/song/backing.test.ts` 3개, E10 반주 스피커 = 참고 `e10/runner.test.ts` "backing on speakers (§8.6)…", E2E-17 `tests/e2e/song-backing.mic.spec.ts`(a 이어폰, b 스피커 누출: backingAudible·박 1 ≥ 0.9·코드 지표 없음) |
| AC-BT1 | 베타 판정기 5종 구현, 베타 지표 보고(BENCHMARK.md 별도 절), 베타 계약(무결성 10), UI "참고(베타)" 라벨. | DONE | M11 부분 완료: 판정기 5종 `src/dsp/beta/`(buzz·direction·palmMute·dynamics, legato는 `verifySequence` HAMMER_OK) + `src/dsp/beta/beta.test.ts`, 베타 벤치 `tools/bench/betaBench.ts`(판정기마다 ≥ 500), 보고(`docs/BENCHMARK.md` "베타 — 게이트 아님"), 계약 무결성 10 `tests/integrity/beta-contract.test.ts`. test 값: buzz 0.62/오경보 0.108, 방향 0.55, 레가토 0.992/0, 팜뮤트 0.999, 셈여림 1.000, 반주 아래 Mode C 0.733(보고만). 남음: UI "참고(베타)" 라벨 연결(M12). M12: UI 라벨 — E5 방향·팜뮤트·셈여림(`e5/E5View.tsx`), E16 버징(`e16/plugin.tsx`), E11 레가토(`e11/plugin.tsx` `e11-legato`), E3 스트럼(`e3/plugin.tsx` `e3-beta`), E1 스트럼(`exercises/ui/MicFeedback.tsx`), 문구 `src/i18n/ko.ts` "참고·베타" |
| AC-S9 | Stage 8–11 보이싱을 넣은 매트릭스에서 v1 Mode A·B·C 임계값 통과. | DONE | `bench:dsp` test(29 보이싱 매트릭스, Stage 8–11 포함, Mode C 50쌍 × G 3종): Mode A 7/7, Mode B 8/8, Mode C 3/3(|오차|≤1 1.000), classifySet 0.997, modeCSetStage8to11 0.999. Mode C 마진 재튜닝 D-066·`docs/DSP.md` 18절. 계약 "Mode A/B cover the 29 voicings…"·"Mode C sequences: … every §6.5 pair…" |
| AC-UX1 | 연습 옵션을 세션 러너 안에서 키로 조작, E2E-22. | DONE | E2E-22 `tests/e2e/options.mic.spec.ts`(E1 M/E, E5 V, S ↑/↓·H가 실행과 Attempt params에 반영). 남음: 반주 키 B(M12). M12: S B 반주 키(연주 단계) — 같은 E2E-22 |
| AC-UX2 | 연습 화면 레벨 미터(잡음 바닥선·최소 레벨선)와 확신도 표시. | DONE | `exercises/ui/MicFeedback.tsx`(연습 화면 레벨 미터 + 잡음 바닥선·판정 최소선, 확신도 확실/아마도/불확실/참고(베타)), `MicFeedback.test.ts`, `ui/LevelMeter.tsx` lines |
| AC-UX3 | 환경 안내, 다이어그램 루트음 강조, 루틴 편집 화면(E2E-20). | DONE | 환경 안내 `ui/EnvironmentGuide.tsx`(온보딩·진단), 루트음 강조 `ChordDiagram.test.tsx` "AC-UX3…", 루틴 편집 E2E-20 `tests/e2e/routine-editor.spec.ts` |
| AC-UX4 | E2E-10·11에 새 화면 포함(4 뷰포트 가로 스크롤 0, 버튼 크기, axe serious/critical 0). | DONE | E2E-10 `tests/e2e/layout.spec.ts`·E2E-11 `tests/e2e/a11y.spec.ts`의 화면 목록 `tests/e2e/support/screens.ts`에 v1.1 화면 15개(Stage 10, 루틴 편집, K1, E16, E3, E9, E10, E11, E12, E17, Q3 strings65, Q4 interval, Q5, S 연주+반주) — chromium·iPad·iPhone 통과(가로 스크롤 0, 큰 버튼 ≥ 64 px, 테마 3종 axe serious/critical 0). 왼손잡이 지판 그림 `src/exercises/e16/picture.test.tsx`, 키 충돌 `src/app/keys.test.ts` "v1.1 option keys…"·`tests/e2e/keys.spec.ts` 학습 알림 (D-070) |
| AC-DT1 | Dexie v2 스키마와 마이그레이션, v1 내보내기 → v2 가져오기 테스트, 왕복 테스트. | DONE | `src/data/migrations.test.ts`: v1 DB → Dexie v2 제자리 업그레이드, v1 내보내기 → v2 가져오기(migration 1→2), v2 필드 왕복(deep-equal), `repo.test.ts` 왕복 |
| AC-W4 | 새 화면의 PWA 오프라인 동작과 CSP 위반 0(반주 재생 포함). | DONE | 오프라인 `tests/e2e/offline.spec.ts`(E10 TAB·S 연주 반주·Stage 10 페이지), CSP `tests/e2e/csp.mic.spec.ts`(반주 재생 연주 단계 + E10 시퀀스 판정 worker) 위반 0 (D-070) |
| AC-F4 | README(초급 2, 새 연습, 반주·이어폰, 30분 세션), `docs/ARCHITECTURE.md`(시퀀스·베타·시뮬레이션), `docs/DSP.md`, `docs/BENCHMARK.md`(새 영역·베타 절), `docs/BACKLOG.md`(v1.1 제외 항목), `docs/MANUAL_VALIDATION.md`(스케일·리프·해머온·반주 이어폰/스피커·Stage 8+ 실기기 항목 추가). | DONE | README(초급 1+2, 새 연습, 반주·이어폰, 30분 세션·분할, 키), `docs/ARCHITECTURE.md`(시퀀스 구간 판정·반주·withHistory·시뮬레이션·무결성), `docs/DSP.md` 15–21절(§10.10–10.12 파라미터·근거·앱 경로), `docs/BENCHMARK.md`(v1.1 영역·베타 절, M11 생성), `docs/BACKLOG.md`(v1.1 §3.2 제외·베타 과제), `docs/MANUAL_VALIDATION.md` 5a절(스케일·리프·해머온·Q3·반주 이어폰/스피커·iOS·Stage 8+ 분할) |
| AC-F5 | `docs/goal/v1.1/FINAL_REPORT.md` 작성. | DONE | `docs/goal/v1.1/FINAL_REPORT.md`(§18.1 1–9절: 요약, verify 요약표, 합성·베타·GuitarSet 지표표, AC 표, 추적표 대조, 커밋, 결정, 알려진 한계, 다음 할 일) |

## 5. 리서치 추적표 대조 결과 (`traceability.json`)

전체 215개 — 구현 202, 제외 13, 연기 0. 무결성 테스트(`tests/integrity/traceability.test.ts`)가 모든 항목의 상태, 구현 항목이 가리키는 SPEC 절·AC ID의 존재, 제외 항목의 근거를 확인한다. **연기 항목은 없다**(SPEC §16.1 축소 조건에 걸리지 않음).

제외 13개:

| id | 근거(리서치) | 권고 | 제외 이유 |
|---|---|---|---|
| `01-m13-blues-solo` | 01:44 | M13 Beginner Blues Solo, Blues Improv | 스테이지 표(01:249)에 없음 — v1.1 범위 밖(§3.2) |
| `01-m11-fingerstyle` | 01:42 | M11 Sus Chords, Fingerstyle | 스테이지 표에 없음 — v1.1 범위 밖(§3.2) |
| `01-m12-distortion` | 01:44 | M12 Distortion, Enter Sandman, Writing Riffs | 스테이지 표에 없음·저작권 곡 — 범위 밖(§3.2) |
| `01-m14` | 01:45 | M14 Playing Without Looking, Thumb Muting, Jamming, Developing Repertoire | 스테이지 표에 없음(레퍼토리 블록만 §11.10으로 반영) — 범위 밖 |
| `01-grade3` | 01:47 | Grade 3 Advancing Beginner 이후 과정 | 초급 2(Stage 11) 이후 과정 — 범위 밖(§3.2) |
| `02-same-note-string` | 02:465 | 같은 음의 줄 식별 | v1.1 §3.2 제외 — 지판 음이름 연주 응답은 음높이만 판정 |
| `02-nnls` | 02 v2 | calibration template NNLS 분해 | v1.1 §3.2 제외 |
| `02-basic-pitch` | 02 v2 | basic-pitch(ONNX) second opinion | v1.1 §3.2 제외 |
| `03-fsrs` | 03:113 | 지식형 항목에 FSRS(ts-fsrs) | D-055: 리서치 01:353의 고정 간격 사다리를 채택(새 의존성 없음, v1 SRS와 일관) |
| `03-review-slot` | 03:114 | 리뷰 큐를 루틴에 "복습 슬롯 5분"으로 | D-058: 20분 세션에서 곡 9분·리서치 블록과 양립 불가 → 같은 종류 블록 안 복습(§7.3-6)으로 대체 |
| `03-tonejs` | 03:79, 03:158 | 백킹 트랙에 Tone.js | 기존 합성기·엔진 예약 재생으로 충분(§4) — 새 의존성 없음 |
| `03-alphatab` | 03:138, 03:141 | 노래/탭에 alphaTab | 자체 TAB 컴포넌트(§6.9)로 충분, 저작권 곡 없음 |
| `03-cloud` | 03 | 클라우드 동기화·계정·텔레메트리 | v1.1 §3.2 제외(서버 필요, local-first D-003) |

## 6. 마일스톤 커밋 (`git log --oneline 5e94332..HEAD`)

이 보고서는 M15 커밋에 들어 있다(그래서 아래 목록 맨 위의 M15 줄은 그 커밋이다 — 최종 출력의 `git log`가 해시를 보여 준다).

```
(이 커밋) M15: hardening and final report
ae357c1 M14: screen finishing
e1e1a87 M13: Beginner 2 progression integration
b08b6bb M12: Beginner 2 content and new exercises
b4db85d M11: DSP, synthesis and benchmark extensions
197db37 M10: Stage 0-7 research restoration
13cbca7 M9: foundation and defect fixes
012fb70 docs(v1.1): goal kit
```

## 7. 주요 결정 요약

전체는 [`docs/goal/DECISIONS.md`](../DECISIONS.md) D-052–D-071.

- **범위·계약**: v1.1 SPEC이 단일 진실 원천, v1 SPEC·임계값·테스트 보존(v1 ⊆ v1.1 계약, 무결성 11). v1 테스트 갱신은 SPEC 근거가 있는 확장만(D-063·D-064·D-066·D-067·D-069 목록).
- **루틴**: 리서치 블록 시간을 스테이지 템플릿으로(D-058), 복습은 같은 종류 블록 안에서(D-058), 쌍 슬롯·필요 쌍 7일 보장, 처방은 추가하고 만료(D-060), 정체 2주 vs 조건부 진급 3주(D-056).
- **DSP**: 시퀀스 음높이는 울림 comb 제거와 clarity 선택, 사이클 판정 순서 고정(D-066). 반주 마스킹은 저역 상승분·전주 누출 이득·도착 직전 재정밀화(D-066), 앱 경로는 사전 렌더·링 안 측정(D-068). Mode C 재튜닝은 dev split에서만(D-066).
- **반주 정책**: 이어폰 확인·출력 장치별 기억, 스피커 = 코드 확인 "참고"·지표 제외, E10 반주 스피커 실행은 참고 전용(D-067).
- **진행**: Stage 7 시험 → 초급 1 수료 + Stage 8, Stage 11 기준 = 초급 2 수료(조건부 없음), 세션 분할 = 한 세션 id(D-069). 시뮬레이션은 플러그인 이력 조정까지 앱과 같은 경로(D-069).
- **화면**: 새 화면 반응형·접근성, 왼손잡이 지판 그림, 페달 학습의 기본 키 대체 알림(D-070).

## 8. 알려진 한계

- **합성·스튜디오 마이크와 실기기의 차이**: 합성 벤치와 GuitarSet(근접 콘덴서, 조용한 방)은 휴대폰·노트북 내장 마이크, 생활 소음, 저가 기타보다 깨끗하다. 실기기 정확도는 `docs/MANUAL_VALIDATION.md`와 녹음 키트 `bench:real`로 확인해야 한다(아직 실기기 fixture 없음).
- **베타 판정의 정답 부재**: 버징(합성 검출 0.62)·스트럼 방향(0.55)·반주 아래 Mode C(0.73)는 목표에 못 미친다. 레가토·팜뮤트·셈여림은 합성에서 목표를 넘지만 실녹음 정답이 없다. 모두 "참고(베타)"로만 보이고 진급에 쓰지 않는다.
- **스피커 반주 아래 판정**: 마스킹은 실측 RTT에 기댄다(±15 ms). RTT 보정이 오래됐거나 출력 장치가 바뀌면(특히 블루투스) 반주 스트럼이 사용자 스트럼으로 셀 수 있다. 코드 확인은 스피커에서 "참고"이고, E10 반주 실행은 스피커면 기록하지 않는다. 이어폰(유선)을 권장한다.
- **iOS 재생 품질**: 마이크를 켠 채 재생하면 WebKit 버그(311451)로 반주·메트로놈 소리가 작거나 거칠 수 있다(앱 안내 문구).
- **시뮬레이션의 학습자 모델**: Stage 0 → 초급 2 수료 도달·교착 0은 고정 수치의 가상 학습자 기준이다. 실제 사람의 정체·결석 양상은 더 다양하다.
- **E2E 하네스**: 가짜 마이크(같은 AudioContext의 MediaStreamDestination)와 DelayNode 루프백으로 실제 장치 지연·잡음을 흉내 낸다. 오프라인 서비스 워커 E2E는 Chromium만(D-048).
- **v1 브랜치의 `src/data` 미추적**: v1(`feat/practice-app-v1`)은 `.gitignore`의 `data/`가 `src/data`까지 무시해 깨끗한 클론이 빌드되지 않는다. 규칙상 v1 브랜치는 고치지 않았고 v1.1 브랜치에서만 고쳤다(D-065).

## 9. 사용자가 다음에 할 일

1. `docs/MANUAL_VALIDATION.md`의 v1.1 항목(5a절: 스케일·리프·해머온·Q3 연주 응답·반주 이어폰/스피커·iOS 반주·Stage 8+ 분할 세션)을 MacBook·iPad·iPhone 실기기로 확인하고 결과 양식을 채운다.
2. 설정 > 녹음 키트로 내 기기 fixture를 만들어 `tests/fixtures/real/<기기>/`에 넣고 `npm run bench:real` — 어긋나는 판정은 `docs/BACKLOG.md`의 재조정 항목으로.
3. `docs/DEPLOY.md` 절차로 배포(HTTPS, 보안 헤더)하고 iPad 홈 화면 앱·오프라인을 확인한다.
4. 위 결과를 보고 `feat/practice-app-v1.1`을 `main`에 병합할지 결정한다(이 작업은 push·병합을 하지 않았다).
