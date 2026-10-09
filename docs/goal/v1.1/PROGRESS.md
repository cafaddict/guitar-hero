# PROGRESS — guitar-hero v1.1 goal

> goal 실행자가 **매 턴 시작 시 읽고, 턴 끝에 갱신**한다. 컨텍스트가 압축된 뒤에는 이 파일과 `docs/goal/v1.1/SPEC.md`만으로 이어갈 수 있어야 한다.
> 상태 값: TODO / DOING / DONE / BLOCKED(AC-SQ2만, GuitarSet 마커가 있을 때). AC-P10은 그 경우 `DONE (G1–G3 BLOCKED)`. 마일스톤 표의 "(부분)" AC는 DOING + 범위 증거로 마일스톤 종료(SPEC §16). DONE에는 증거(테스트 파일·테스트 이름·명령·산출물 경로)를 적는다.
> v1 진행 기록은 `docs/goal/PROGRESS.md`(보존, 수정하지 않음).

## 현재 상태

- 현재 마일스톤: **M12 (초급 2 콘텐츠·새 연습)** 시작 전 — M9 `13cbca7`, M10 `197db37`, M11 커밋(이 커밋)
- 시작 지점: `feat/practice-app-v1.1`, v1.1 키트 커밋 `012fb70`(부모 `5e94332`)
- 마일스톤 끝 리뷰 서브에이전트: M10(완료, D-065 반영)·M12·M15
- 마지막 갱신: 2026-10-09 (M11 verify PASS: test 1503/1503, bench:dsp all thresholds met; beta reported, bench:guitarset hard 6/6 soft 3/3, e2e 44/44 4 projects. 첫 verify는 typecheck 1건으로 FAIL → 고쳐 재실행)
- 누적 턴(대략): 2
- 턴 상한: **1000**. §16.1 축소 조건은 턴 수가 아니라 "M13 커밋 이후, 같은 하위 항목 때문에 마일스톤 verify 3회 연속 실패"(SPEC §2.6).
- M11 요약(D-066, `docs/DSP.md` 15–20절):
  - 계약 파일 전환(`tools/bench/thresholds.ts` → v1.1), 판정 키 양방향·v1.1 매트릭스 커버리지·베타 계약(무결성 10).
  - DSP: `sequence.ts`(verifySequence, 울림 comb 제거, `judgeSequenceNote`), `backingMask.ts`, `beta/` 5종, Mode C 마진 재튜닝, `DETECTOR_VERSION` 1.4.0.
  - 합성: `synth/sequence.ts`·`effects.ts`·`backing.ts`(앱·벤치 공용, `chordAt`).
  - 콘텐츠 선행: 보이싱 E5·A5·D5·F5, `scales.ts`, P6–P8·`patternSlotTimes`.
- 다음 할 일(M12):
  1. 콘텐츠: Stage 8–11 곡 8곡+(블루스 3곡)·스테이지 코드 제약, 커리큘럼 Stage 8–11 진행 데이터·규칙(잠금 유지는 M13까지).
  2. 연습: E3(+OMC→PFC 처방), E9, E10(스케일 사다리·암기), E11(하루 상한·레가토 베타 표시), E12, E17 마이크 판정(§10.10 연결 → 무결성 9에 `verifySequence` 추가), Q3 범위(openPosition·strings65), Q4 종류(interval·progression).
  3. 반주(§8.6): `renderBacking`으로 AudioBuffer 예약, 전주 1마디(D-066), 이어폰 확인·장치 라벨 기억·블루투스 경고, 스피커면 `PickOptions.backing` 마스킹 + 코드 판정 "참고", `backingAudible` 저장, 반주 키 B. 앱 경로의 스트럼 onset이 worklet 스트리밍이면 반주 마스킹은 테이크 끝 오프라인 재검출로(설계 확인).
  4. 베타 UI "참고(베타)" 라벨(E5 셈여림·팜뮤트, E11 레가토, E16 버징 등).
  5. E2E-16·17·21·22(반주 키), 리뷰 서브에이전트, verify, 커밋.
- 막힌 점: 없음.
- 미룬 작은 일(M13): 레퍼토리 블록 안 "이어서 한 번 더"가 다음 레퍼토리 곡으로 넘어가기(§11.10 "차례로 친다").
- 메모: 타입 검사는 반드시 `npm run typecheck`(app·node·worklet 3개 tsconfig)로 한다. `tsc -p .`는 앱 코드를 검사하지 않아 M11 첫 verify가 typecheck에서 걸렸다(`noUncheckedIndexedAccess`).
- 메모: `keys.spec.ts` "after a run Space…"는 무거운 병렬 E2E에서 한 번 실패한 적이 있음(이후 verify 2회 통과).

## 마일스톤

| M | 이름 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| M9 | 기반·결함 수정 | DONE | `13cbca7` | verify PASS |
| M10 | Stage 0–7 리서치 복원 | DONE | `197db37` | verify PASS, 리뷰 D-065 |
| M11 | DSP·합성·벤치 확장 | DONE | (이 커밋) | verify PASS, bench test all met(+beta reported), GuitarSet hard 6/6 soft 3/3 |
| M12 | 초급 2 콘텐츠·새 연습 | TODO | | 끝에 code-reviewer |
| M13 | 초급 2 진행 통합 | TODO | | |
| M14 | 화면 마감 | TODO | | |
| M15 | 하드닝·최종 검증 | TODO | | 끝에 code-reviewer |

## Acceptance Criteria (SPEC v1.1 §17)

| AC | 요약 | 상태 | 증거 |
|---|---|---|---|
| AC-P7 | `feat/practice-app-v1.1`에 키트 커밋 이후 M9–M15 커밋 존재, `main`은 `9e7eda6`, `feat/practice-app-v1`은 `5e94332` 그대로, 원격 push 없음(upstream 없음), 작업 트리 clean. | TODO | |
| AC-P8 | v1 `SPEC.md`·`thresholds.json`과 v1.1 `SPEC.md`·`thresholds.json`·`traceability.json`·`GAP_AUDIT.md`의 SHA-256이 goal 조건문의 값과 같다. | TODO | |
| AC-P9 | `npm ci && npm run verify` exit 0, §14.7 형식 요약표(v1.1 계약 기준). | TODO | |
| AC-P10 | v1 AC(P1–P6, D1–D5, A1–A5, S1–S8, G1–G3, X1–X10, R1–R5, U1–U6, T1–T4, W1–W3, F1–F3) 보존 | DOING | M9·M10·M11 verify PASS(v1 단위·E2E·bench). v1 테스트 갱신은 D-063·D-064·D-066 목록뿐(D-066: 보이싱 25→29, Mode C 쌍 25→50 × G 3종 — 확장만). v1 Mode D는 v1 패턴 그대로, v1 스트럼 GuitarSet F1 0.877 유지. 참고: v1의 `src/data` 미추적 결함을 v1.1에서 고침(D-065) |
| AC-TR1 | `traceability.json` 완전성 무결성 테스트 통과, FINAL_REPORT에 항목별 대조 결과(구현·제외·연기 수). | TODO | |
| AC-TR2 | 모든 learn 항목의 `practicedBy` 유효(무결성 8) + 커버리지 단언 Stage 0–11 통과. | DOING | Stage 0–7: `src/domain/simulate.test.ts` "every learn item is practised at least twice…"(improving 0–7, blank 0–1, pain 0–7, plateau 3, withReviews 5), 무결성 8 `tests/integrity/learn-table.test.ts`. 남음: Stage 8–11(M13) |
| AC-TR3 | 진급 규칙 ↔ 루틴 대응과 도달 단언 통과, 교착 0. | TODO | |
| AC-TR4 | SPEC 요구 함수 프로덕션 호출 검사(무결성 9) 통과. | DOING | M9–M11 목록 7개: `tests/integrity/production-calls.test.ts`. `verifySequence`는 M12(§16 단계화) |
| AC-RT1 | 스테이지 시간 템플릿 합계·배치 테스트, Stage 8–11 30분과 분할, 레퍼토리 블록. | DOING | Stage 0–7: `routine.test.ts` "rule 2 (v1.1 §7.3-2)…"(K1 있는/없는 날 합계 1200, 블록 구성), `v11Records.test.ts` "every template sums to T…"(0–11), `simulate.test.ts` "Σ block time = …"(28일). 남음: Stage 8–11 30분·분할·레퍼토리(M13) |
| AC-RT2 | 쌍 슬롯 배정과 7일 배정 보장, 순환 블록 3세션 보장, 처방 추가·만료(기술 항목을 몰아내지 않음). | DOING | Stage 0–7: `src/domain/simulate.test.ts` "every rotation entry appears…"·"required, unpassed pairs…"(Stage 0–7×improving, blank 0–1, pain), "plateau learner…"(처방 추가·② 배치·8세션 만료·순환 유지); `routine.test.ts` rule 3 두 개. 남음: E3 처방(M12), Stage 8–11(M13) |
| AC-RT3 | 복습 배정(같은 종류 블록, 밀림 방지, 7일 안 배정), 지식 카드 간격 반복. | DOING | `simulate.test.ts` "withReviews learner, Stage 5 (AC-RT3)…"(30개 동시 due: FIFO·지연 ≤ max(7,⌈q/c⌉+1)), `routine.test.ts` "rule 6 (v1.1 §7.3-6)…"·"rule 6 (cards)…", `v11Records.test.ts` 카드 사다리·"a due review moves one step per due date", `quiz/cards.test.ts`. 남음: 스케일 단계 복습(M12) |
| AC-RT4 | 블록 시간 반복·끝 신호·전환 화면. | DONE | `session.test.ts` "SPEC v1.1 §7.3-12·13 block time…"(전환 화면 조건, 전환 시간은 블록 시간 밖), SessionScreen 블록 끝 신호(액센트 클릭 2번 + "블록 끝")·"이어서 한 번 더"(사다리 다음 템포, Space), E2E-07·E2E-15가 전환 화면을 거쳐 끝까지 진행 |
| AC-RT5 | 파라미터 의미: progression 코드 진행, 사다리 현재 BPM, E7 시작 프렛, 통증 감량 실행 반영. | DOING | v1 연습: `simulate.test.ts` "parameters: progression mode…"(진행 코드 ≥2, 사다리 현재 BPM·−10 처방, E7 시작 프렛), "pain learner…"(E1·E2 실행 파라미터 절반); `session.test.ts` pain ≥5. 남음: Stage 9 tabHidden·Q3 20문항·레퍼토리(M13) |
| AC-PG1 | Stage 0–11 규칙 데이터와 새 규칙 종류 단위 테스트, Stage 7 → 8 진급, 초급 2 수료. | TODO | |
| AC-PG2 | 정체 감지 연결과 처방 표, 조건부 진급 3주, 2주/3주 구분 테스트. | DOING | `src/domain/sessionPrep.test.ts`(세션 시작 detectStagnation → 처방, 만료), `progression.test.ts` "stagnation (v1.1 §7.4)"·"conditional promotion (v1.1 §7.4)", `simulate.test.ts` plateau(22연습일 안 조건부 진급). 남음: PFC↔OMC E3 처방(M12) |
| AC-PG3 | G 보이싱 3단 전환 제안(`suggestedGVoicing` 연결), E7 시작 프렛 조정(`nextStretchStartFret` 연결). | DONE | `sessionPrep.test.ts` "AC-PG3: suggests the three-finger G…"(G-2f→G-3f Stage 6, G-3f→G-4f Stage 8), `simulate.test.ts` "G voicing: the switch…"(수락 후 E1 G-3f)·"E7 start fret…"(5,5,5,4,4,4,3…), `v11Records.test.ts` "E7 start fret from the records", 홈 추천 카드(HomeScreen `g-switch`), 무결성 9 호출 검사 |
| AC-CT1 | 보이싱 29개 검증, 스케일 3개 검증, 리프 4개와 TAB 렌더, 패턴 P6–P8과 스윙 그리드, Stage 8–11 쌍, 연습곡 18곡+ 스테이지 코드 제약과 블루스 형식. | DOING | M11 선행분: 보이싱 29개(`src/content/voicings.test.ts`), 스케일 3개와 E10 1–5단계·E9 묶음(`src/content/scales.test.ts`), 패턴 P6–P8·스윙 그리드(`src/dsp/synth/v11.test.ts`). 남음: 리프 TAB 렌더 검증·Stage 8–11 곡·블루스(M12) |
| AC-NE1 | K1 자가 체크 카드와 루틴 배정 규칙. | DOING | K1 플러그인·`k1/runner.test.ts`, 배정 규칙 `routine.test.ts` "Stage 0 (v1.1)…", E2E-15 K1 카드 저장. Stage 0·2 완료. 남음: Stage 8·10 항목(M13) |
| AC-NE2 | E16 프렛 위치 비교, E2E-15. | DONE | `e16/runner.test.ts`(Mode A 세 위치·자가 판정), E2E-15 `tests/e2e/stage0.mic.spec.ts` 두 개(키보드 Stage 0 세션 저장; fixture ① OK ③ MUTED, detectorVersion·processingMs) |
| AC-NE3 | E3 정확 빠른 체인지, 통과·졸업·안내. | TODO | |
| AC-NE4 | E9 크로매틱, E10 스케일 사다리 1–5단계·사다리·암기, E12 새끼손가락, E2E-16. | TODO | |
| AC-NE5 | E11 해머온, 하루 상한, 레가토 베타 표시. | TODO | |
| AC-NE6 | E17 리프, Q5 TAB 퀴즈. | DOING | E17 자가 보고 경로 `e17/runner.test.ts`(사다리 4회 연속·−5 규칙, H 키), Q5 `quiz/cards.test.ts` "Q5 TAB reading…", TAB 렌더 `ui/Tab.tsx`. 남음: E17 §10.10 마이크 판정·R3·R4(M12) |
| AC-NE7 | Q3 범위 확장, Q4 종류 확장, E2E-21. | TODO | |
| AC-NE8 | S 곡 단계(학습·연주·숨김)·완주·암기·레퍼토리 정의. | DOING | 곡 단계·완주·암기·레퍼토리 지표 `v11Records.test.ts` "song stages…", 멈춤 자동 집계·키 `song/v11.test.ts`, 루틴 곡 블록 단계 `simulate.test.ts`(Stage 2 연주 완주로 진급), 졸업 시험 5번 `examModel.test.ts`. 남음: 반주·코드 확인(M12), 레퍼토리 블록 곡 순환(M13) |
| AC-NE9 | E5 v1.1 추가(P6–P8, 모드 사다리, 보정 hit_rate 기준, 박 세기·발 박자 안내, 시각 큐 숨김 키, 셈여림 모드, 팜뮤트 옵션), E6 Stage 1·사다리·코드 확인, E8 사다리 저장. | DOING | E5: V 키·박 번호·셈여림 자가 평가·보정 hit_rate 사다리 `e5/v11.test.ts`; E6 Stage 1(템플릿)·사다리 `ladderBpm`·코드 확인 `e6/runner.test.ts` "chordCorrectRatio…"; E8 사다리 저장 `v11Records.test.ts`. 남음: P6–P8·스윙·팜뮤트 옵션(M12) |
| AC-EX1 | E0·온보딩 튜닝 방향 안내와 건너뛰기, E1 경향 요약·모드 키, E7 안내 문구. | DONE | `tuningGuide.test.ts`(조이기/풀기·줄감개 방향), `ui/TuningDirection.tsx`(온보딩·E0·튜너), `calibrationModel.test.ts` "AC-EX1 (v1.1 §9.3): strings skipped…", E1 경향 `e1/tendency.test.ts`, 모드 키 E2E-22, E7 안내 문구 `ko.exercises.e7.how` |
| AC-SQ1 | §14.8 sequence 지표 전부 통과(합성 test split). | DONE | `npm run bench:dsp`(test, detector 1.4.0): sequence 8/8 — note onset F1 0.9994, clean 음 OK 0.9978, 틀린 음 1.000, MISSED 1.000, EXTRA 0.9875, 결함 사이클 무실수 오판 0.0021, clean 무실수 1.000(n 136), 불확실 0.000. 구현 `src/dsp/sequence.ts`, 단위 `src/dsp/sequence.test.ts`, 계약 커버리지 `tests/integrity/thresholds-contract.test.ts` "sequence: …"(3개) |
| AC-SQ2 | GuitarSet solo 시퀀스 하드 지표 통과, 소프트 지표 보고(미달 시 개선 시도·원인 분석을 `docs/DSP.md`에). | DONE | `npm run bench:guitarset`(test 04–05): soloSequencePitchOkRate 0.9868(n 2654 ≥ 1000), 교란 오수용 0.0004 — 하드 2/2, 소프트 onset F1 0.8101 ≥ 0.75. 개선 기록 `docs/DSP.md` 15·19절(clarity 선택·기준, dev 0.912 → 0.973), D-066 |
| AC-SW1 | §14.8 swing 지표 통과. | DONE | `bench:dsp` test: swing F1 0.9924, |오차| p95 9.23 ms, 슬롯 배정 0.9714. 스윙 그리드 `patternSlotTimes`(`src/dsp/synth/v11.test.ts` "swing slots…"), `analyzeTiming.strumSlots`(`src/dsp/backingMask.test.ts` "§14.8 swing slot assignment"), 계약 "swing: …" |
| AC-BK1 | §14.8 backingBleed 지표 통과 + 반주 정책 + E2E-17. | DOING | M11 DSP 부분 완료: `bench:dsp` test backingBleed F1 0.9863, 반주 오검출 0.0049. 마스킹 `src/dsp/backingMask.ts`(+ `onset.ts` `PickOptions.backing`), 반주 합성 `src/dsp/synth/backing.ts`, 단위 `src/dsp/backingMask.test.ts`(−10/−18/−25 dB), 계약 상수 대조 "backing bleed: …". 남음: 반주 재생·이어폰 정책·E2E-17(M12) |
| AC-BT1 | 베타 판정기 5종 구현, 베타 지표 보고(BENCHMARK.md 별도 절), 베타 계약(무결성 10), UI "참고(베타)" 라벨. | DOING | M11 부분 완료: 판정기 5종 `src/dsp/beta/`(buzz·direction·palmMute·dynamics, legato는 `verifySequence` HAMMER_OK) + `src/dsp/beta/beta.test.ts`, 베타 벤치 `tools/bench/betaBench.ts`(판정기마다 ≥ 500), 보고(`docs/BENCHMARK.md` "베타 — 게이트 아님"), 계약 무결성 10 `tests/integrity/beta-contract.test.ts`. test 값: buzz 0.62/오경보 0.108, 방향 0.55, 레가토 0.992/0, 팜뮤트 0.999, 셈여림 1.000, 반주 아래 Mode C 0.733(보고만). 남음: UI "참고(베타)" 라벨 연결(M12) |
| AC-S9 | Stage 8–11 보이싱을 넣은 매트릭스에서 v1 Mode A·B·C 임계값 통과. | DONE | `bench:dsp` test(29 보이싱 매트릭스, Stage 8–11 포함, Mode C 50쌍 × G 3종): Mode A 7/7, Mode B 8/8, Mode C 3/3(|오차|≤1 1.000), classifySet 0.997, modeCSetStage8to11 0.999. Mode C 마진 재튜닝 D-066·`docs/DSP.md` 18절. 계약 "Mode A/B cover the 29 voicings…"·"Mode C sequences: … every §6.5 pair…" |
| AC-UX1 | 연습 옵션을 세션 러너 안에서 키로 조작, E2E-22. | DOING | E2E-22 `tests/e2e/options.mic.spec.ts`(E1 M/E, E5 V, S ↑/↓·H가 실행과 Attempt params에 반영). 남음: 반주 키 B(M12) |
| AC-UX2 | 연습 화면 레벨 미터(잡음 바닥선·최소 레벨선)와 확신도 표시. | DONE | `exercises/ui/MicFeedback.tsx`(연습 화면 레벨 미터 + 잡음 바닥선·판정 최소선, 확신도 확실/아마도/불확실/참고(베타)), `MicFeedback.test.ts`, `ui/LevelMeter.tsx` lines |
| AC-UX3 | 환경 안내, 다이어그램 루트음 강조, 루틴 편집 화면(E2E-20). | DONE | 환경 안내 `ui/EnvironmentGuide.tsx`(온보딩·진단), 루트음 강조 `ChordDiagram.test.tsx` "AC-UX3…", 루틴 편집 E2E-20 `tests/e2e/routine-editor.spec.ts` |
| AC-UX4 | E2E-10·11에 새 화면 포함(4 뷰포트 가로 스크롤 0, 버튼 크기, axe serious/critical 0). | TODO | |
| AC-DT1 | Dexie v2 스키마와 마이그레이션, v1 내보내기 → v2 가져오기 테스트, 왕복 테스트. | DONE | `src/data/migrations.test.ts`: v1 DB → Dexie v2 제자리 업그레이드, v1 내보내기 → v2 가져오기(migration 1→2), v2 필드 왕복(deep-equal), `repo.test.ts` 왕복 |
| AC-W4 | 새 화면의 PWA 오프라인 동작과 CSP 위반 0(반주 재생 포함). | TODO | |
| AC-F4 | README(초급 2, 새 연습, 반주·이어폰, 30분 세션), `docs/ARCHITECTURE.md`(시퀀스·베타·시뮬레이션), `docs/DSP.md`, `docs/BENCHMARK.md`(새 영역·베타 절), `docs/BACKLOG.md`(v1.1 제외 항목), `docs/MANUAL_VALIDATION.md`(스케일·리프·해머온·반주 이어폰/스피커·Stage 8+ 실기기 항목 추가). | TODO | |
| AC-F5 | `docs/goal/v1.1/FINAL_REPORT.md` 작성. | TODO | |

## 턴 로그 (최근 것이 위, 한 줄씩)

- 턴 1 (2026-10-09): M10 — 옵션 키·Attempt params, E5 박 번호·셈여림·보정 사다리, E6 코드 확인, 곡 단계·멈춤 집계, 블록 반복·끝 신호·전환 화면, Q3·Q4 카드·Q2 나누기, 튜닝 방향·건너뛰기, 레벨 미터·확신도, 환경 안내, 루트음, E1 경향, learn 커버리지·복습 FIFO 시뮬레이션, E2E-15·20·22. 리뷰(critical: `src/data` 미추적) 반영. verify PASS → M10 커밋.
- 턴 1 (2026-10-09): M9 구현 — 스키마 v2·마이그레이션, 커리큘럼 v1.1 데이터(learn→practicedBy, 순환 목록, 새 규칙), 시간 템플릿 루틴 생성기, 진급 엔진(새 규칙·2주 정체·3주 조건부·처방·G 3단), 세션 시작 처리, 시뮬레이션 하네스(Stage 0–7 도달 79일·교착 0), 무결성 7·8·9·11, K1·E16·E17·Q5 기본형, 루틴 편집, v1 테스트 갱신(D-063). verify PASS → M9 커밋.
